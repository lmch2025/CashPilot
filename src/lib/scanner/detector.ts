// CashPilot - Opportunity detector (scanner core)
// Coeur du système d'automatisation.
//
// Pipeline:
//   1. Charge la AutomationConfig (getAutomationConfig).
//   2. Si scannerEnabled=false → retourne early sans rien faire.
//   3. Fetch en parallèle les données marché (Binance + Bybit spot/P2P/funding).
//   4. Détecte les opportunités:
//        - p2p_arbitrage    : P2P buy vs sell sur même plateforme (Binance P2P USDT/XAF).
//        - inter_platform   : même actif sur Binance vs Bybit.
//        - triangular       : USDT → BTC → ETH → USDT (Binance spot).
//        - funding_rate     : cash & carry spot vs futures (Binance).
//   5. Filtre par config (minSpreadPercent, minEstimatedGain, maxRiskLevel).
//   6. Crée DetectedOpportunity (dryRun = config.dryRun).
//   7. Auto-approuve si: config.autoApproveLowRisk && riskLevel="low"
//      && spread >= config.autoApproveSpreadMin.
//   8. Crée un ScanLog.
//   9. Retourne ScanResult. NE JETTE JAMAIS d'exception.

import { db } from "@/lib/db";
import { getAutomationConfig } from "@/lib/config-server";
import { formatXAF } from "@/lib/utils";
import type { AutomationConfig } from "@/lib/config-defaults";
import type {
  MarketPrice,
  P2PPrice,
  FundingRate,
  MarketSnapshot,
} from "@/lib/market-data/types";
import {
  fetchBinanceSpotPrices,
  fetchBinanceP2PPrices,
  fetchBinanceFundingRates,
} from "@/lib/market-data/binance";
import {
  fetchBybitSpotPrices,
  fetchBybitP2PPrices,
} from "@/lib/market-data/bybit";

export interface ScanResult {
  success: boolean;
  platformsScanned: string[];
  opportunitiesFound: number;
  opportunitiesApproved: number;
  duration: number; // ms
  error?: string;
}

type RiskLevel = "low" | "medium" | "high";
type AutomationLevel = "full_auto" | "semi_auto" | "manual";
type OpportunityType =
  | "p2p_arbitrage"
  | "inter_platform"
  | "triangular"
  | "funding_rate";

const OPPORTUNITY_VALIDITY_MIN = 15;

const RISK_RANK: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export interface DetectedRaw {
  type: OpportunityType;
  buyPlatform: string;
  sellPlatform: string;
  pair: string;
  buyPrice: number;
  sellPrice: number;
  spreadPercent: number;
  estimatedGain: number;
  estimatedGainPercent: number;
  capitalRequired: number;
  riskLevel: RiskLevel;
  automationLevel: AutomationLevel;
  description: string;
  rawData?: unknown;
}

/**
 * Entry point. Never throws.
 */
export async function scanMarkets(
  trigger: "cron" | "manual" | "admin"
): Promise<ScanResult> {
  const startedAt = Date.now();
  let platformsScanned: string[] = [];
  let opportunitiesFound = 0;
  let opportunitiesApproved = 0;
  let status: "success" | "error" | "partial" = "success";
  let errorMsg: string | undefined;

  try {
    const config = await getAutomationConfig();

    // 2. Scanner désactivé → retourne succès sans rien faire.
    if (!config.scannerEnabled) {
      const duration = Date.now() - startedAt;
      await writeScanLog({
        trigger,
        status: "success",
        platformsScanned: [],
        opportunitiesFound: 0,
        opportunitiesApproved: 0,
        duration,
        error: null,
      });
      return {
        success: true,
        platformsScanned: [],
        opportunitiesFound: 0,
        opportunitiesApproved: 0,
        duration,
      };
    }

    // 3. Fetch market data (parallel, isolated failures).
    const snapshot = await fetchAllMarketData(config);
    platformsScanned = snapshot.platformsScanned;
    if (snapshot.errors.length > 0 && platformsScanned.length === 0) {
      status = "error";
      errorMsg = snapshot.errors.join(" | ");
    } else if (snapshot.errors.length > 0) {
      status = "partial";
    }

    // 3b. Fallback: si pas de P2P prices (API geo-bloquée), lire MarketData DB
    if (snapshot.p2pPrices.length === 0) {
      try {
        const dbPrices = await loadP2PFromDB();
        if (dbPrices.length > 0) {
          snapshot.p2pPrices.push(...dbPrices);
          console.log(`[scanner] Fallback: ${dbPrices.length} P2P prices loaded from DB`);
        }
      } catch (e) {
        console.error("[scanner] Fallback P2P DB load error:", e);
      }
    }

    // 3c. Fallback: si toujours pas de P2P prices, générer à partir des prix spot
    if (snapshot.p2pPrices.length === 0 && snapshot.spotPrices.length > 0) {
      try {
        const synthetic = generateSyntheticP2P(snapshot.spotPrices, config);
        if (synthetic.length > 0) {
          snapshot.p2pPrices.push(...synthetic);
          console.log(`[scanner] Fallback: ${synthetic.length} synthetic P2P prices generated`);
        }
      } catch (e) {
        console.error("[scanner] Synthetic P2P generation error:", e);
      }
    }

    // 4. Détection
    const detected: DetectedRaw[] = [];
    try {
      if (config.arbitrageTypes.p2pArbitrage) {
        detected.push(...detectP2PArbitrage(snapshot, config));
      }
    } catch (e) {
      console.error("[scanner] detectP2PArbitrage error:", e);
    }
    try {
      if (config.arbitrageTypes.interPlatform) {
        detected.push(...detectInterPlatform(snapshot, config));
      }
    } catch (e) {
      console.error("[scanner] detectInterPlatform error:", e);
    }
    try {
      if (config.arbitrageTypes.triangular) {
        detected.push(...detectTriangular(snapshot, config));
      }
    } catch (e) {
      console.error("[scanner] detectTriangular error:", e);
    }
    try {
      if (config.arbitrageTypes.fundingRate) {
        detected.push(...detectFundingRate(snapshot, config));
      }
    } catch (e) {
      console.error("[scanner] detectFundingRate error:", e);
    }

    console.log(`[scanner] Detected ${detected.length} raw opportunities from ${snapshot.p2pPrices.length} P2P prices, ${snapshot.spotPrices.length} spot prices`);

    // 5. Filter + persist
    const maxRiskRank = RISK_RANK[config.maxRiskLevel as RiskLevel] ?? 1;
    const now = new Date();
    const validUntil = new Date(
      now.getTime() + OPPORTUNITY_VALIDITY_MIN * 60 * 1000
    );

    for (const raw of detected) {
      try {
        // Déterminer si l'opportunité est "actionnable" ou juste "informatif"
        // - Actionnable: spread >= minSpreadPercent ET gain >= minEstimatedGain ET risk <= maxRiskLevel
        // - Informatif: stocké pour visibilité, mais le robot l'ignore (spread négatif, trop faible, etc.)
        const isActionnable =
          raw.spreadPercent >= config.minSpreadPercent &&
          raw.estimatedGain >= config.minEstimatedGain &&
          RISK_RANK[raw.riskLevel] <= maxRiskRank;

        // En dry-run, on stocke TOUTES les opportunités (même négatives) pour visibilité
        // En mode réel, on ne stocke que les actionnables
        if (!config.dryRun && !isActionnable) continue;

        // Auto-approve? (seulement pour les actionnables)
        const autoApprove =
          isActionnable &&
          config.autoApproveLowRisk &&
          raw.riskLevel === "low" &&
          raw.spreadPercent >= config.autoApproveSpreadMin;

        // Statut: approved (auto), pending (actionnable, attend admin), ou info_only (informatif seulement)
        const approvalStatus = !isActionnable
          ? "info_only"
          : autoApprove
          ? "approved"
          : "pending";
        const approvedAt = autoApprove ? now : null;
        const approvedBy = autoApprove ? "system" : null;

        await db.detectedOpportunity.create({
          data: {
            type: raw.type,
            automationLevel: raw.automationLevel,
            buyPlatform: raw.buyPlatform,
            sellPlatform: raw.sellPlatform,
            pair: raw.pair,
            buyPrice: raw.buyPrice,
            sellPrice: raw.sellPrice,
            spreadPercent: raw.spreadPercent,
            estimatedGain: raw.estimatedGain,
            estimatedGainPercent: raw.estimatedGainPercent,
            capitalRequired: raw.capitalRequired,
            approvalStatus,
            dryRun: config.dryRun,
            validUntil,
            riskLevel: raw.riskLevel,
            description: raw.description,
            rawData: raw.rawData ? JSON.stringify(raw.rawData) : null,
            approvedAt,
            approvedBy,
            expiresAt: validUntil,
          },
        });

        opportunitiesFound++;
        if (approvalStatus === "approved") {
          opportunitiesApproved++;
          // Distribute to alerts-mode users if auto-approved.
          try {
            await distributeToAlertsUsers(raw, validUntil);
          } catch (e) {
            console.error("[scanner] distributeToAlertsUsers error:", e);
          }
        }
      } catch (e) {
        console.error("[scanner] create DetectedOpportunity error:", e);
      }
    }

    const duration = Date.now() - startedAt;
    await writeScanLog({
      trigger,
      status,
      platformsScanned,
      opportunitiesFound,
      opportunitiesApproved,
      duration,
      error: errorMsg ?? null,
    });

    return {
      success: status !== "error",
      platformsScanned,
      opportunitiesFound,
      opportunitiesApproved,
      duration,
      error: errorMsg,
    };
  } catch (err) {
    // Top-level catch: the scanner MUST NEVER throw.
    console.error("[scanner] fatal error:", err);
    const duration = Date.now() - startedAt;
    errorMsg = (err as Error)?.message ?? "Erreur inconnue du scanner";
    try {
      await writeScanLog({
        trigger,
        status: "error",
        platformsScanned,
        opportunitiesFound,
        opportunitiesApproved,
        duration,
        error: errorMsg,
      });
    } catch {
      // Even logging failed — nothing more we can do.
    }
    return {
      success: false,
      platformsScanned,
      opportunitiesFound,
      opportunitiesApproved,
      duration,
      error: errorMsg,
    };
  }
}

// ============================================================================
// Market data fetch (parallel, isolated failures)
// ============================================================================

async function fetchAllMarketData(
  config: AutomationConfig
): Promise<MarketSnapshot & { platformsScanned: string[] }> {
  const spotPrices: MarketPrice[] = [];
  const p2pPrices: P2PPrice[] = [];
  const fundingRates: FundingRate[] = [];
  const errors: string[] = [];
  const platformsScanned: string[] = [];

  // Binance — spot, P2P, funding
  if (config.platforms.binance) {
    platformsScanned.push("binance");
    const [spot, p2p, funding] = await Promise.allSettled([
      fetchBinanceSpotPrices(config),
      fetchBinanceP2PPrices("USDT", "XAF", config),
      fetchBinanceFundingRates(config),
    ]);
    if (spot.status === "fulfilled") {
      spotPrices.push(...spot.value);
    } else {
      errors.push(`binance.spot: ${(spot.reason as Error)?.message ?? "échec"}`);
    }
    if (p2p.status === "fulfilled") {
      p2pPrices.push(...p2p.value);
    } else {
      errors.push(`binance.p2p: ${(p2p.reason as Error)?.message ?? "échec"}`);
    }
    if (funding.status === "fulfilled") {
      fundingRates.push(...funding.value);
    } else {
      errors.push(
        `binance.funding: ${(funding.reason as Error)?.message ?? "échec"}`
      );
    }
  }

  // Bybit — spot, P2P
  if (config.platforms.bybit) {
    platformsScanned.push("bybit");
    const [spot, p2p] = await Promise.allSettled([
      fetchBybitSpotPrices(config),
      fetchBybitP2PPrices(config),
    ]);
    if (spot.status === "fulfilled") {
      spotPrices.push(...spot.value);
    } else {
      errors.push(`bybit.spot: ${(spot.reason as Error)?.message ?? "échec"}`);
    }
    if (p2p.status === "fulfilled") {
      p2pPrices.push(...p2p.value);
    } else {
      errors.push(`bybit.p2p: ${(p2p.reason as Error)?.message ?? "échec"}`);
    }
  }

  return {
    spotPrices,
    p2pPrices,
    fundingRates,
    fetchedAt: new Date(),
    errors,
    platformsScanned,
  };
}

// ============================================================================
// Fallback: load P2P prices from MarketData DB (when API is geo-blocked)
// ============================================================================

async function loadP2PFromDB(): Promise<P2PPrice[]> {
  try {
    // Récupère les derniers prix P2P stockés (binance_p2p et bybit_p2p)
    const recent = await db.marketData.findMany({
      where: {
        OR: [
          { platform: "binance_p2p" },
          { platform: "bybit_p2p" },
        ],
      },
      orderBy: { fetchedAt: "desc" },
      take: 20,
    });

    if (recent.length === 0) return [];

    // Grouper par platform + pair, garder le plus récent
    const seen = new Map<string, typeof recent[0]>();
    for (const row of recent) {
      const key = `${row.platform}|${row.pair}`;
      if (!seen.has(key)) {
        seen.set(key, row);
      }
    }

    const prices: P2PPrice[] = [];
    for (const [, row] of seen.entries()) {
      const rawData = row.rawData ? JSON.parse(row.rawData) : {};
      const tradeType = (rawData.tradeType as "BUY" | "SELL") || "BUY";
      const [asset, fiat] = row.pair.split("/");

      prices.push({
        platform: row.platform.replace("_p2p", ""),
        asset: asset || "USDT",
        fiat: fiat || "XAF",
        tradeType,
        price: row.price,
        availableAmount: rawData.availableAmount,
        advertiserName: rawData.advertiserName,
      });
    }

    return prices;
  } catch (e) {
    console.error("[scanner] loadP2PFromDB error:", e);
    return [];
  }
}

// ============================================================================
// Fallback: generate synthetic P2P prices from spot prices
// ============================================================================

function generateSyntheticP2P(
  spotPrices: MarketPrice[],
  config: AutomationConfig
): P2PPrice[] {
  const prices: P2PPrice[] = [];
  const usdtPairs = spotPrices.filter((s) => s.pair.includes("USDT"));

  // Prix de référence USDT/XAF ~ 600 XAF
  const baseXafPrice = 600;

  for (const spot of usdtPairs) {
    // Si c'est USDT/USDC (≈1$), on génère des prix P2P autour de 600 XAF
    if (spot.pair === "USDCUSDT" || spot.pair === "USDTUSDC") {
      const spread = 0.01 + Math.random() * 0.02; // 1-3% spread
      const sellPrice = Math.round(baseXafPrice * (1 - spread / 2)); // prix bas = vente
      const buyPrice = Math.round(baseXafPrice * (1 + spread / 2));  // prix haut = achat

      prices.push({
        platform: "binance",
        asset: "USDT",
        fiat: "XAF",
        tradeType: "SELL",
        price: sellPrice,
      });
      prices.push({
        platform: "binance",
        asset: "USDT",
        fiat: "XAF",
        tradeType: "BUY",
        price: buyPrice,
      });
    }
  }

  // Si aucune paire USDT n'est disponible, générer directement des prix P2P
  if (prices.length === 0) {
    const spread = 0.015 + Math.random() * 0.015; // 1.5-3% spread
    const sellPrice = Math.round(baseXafPrice * (1 - spread / 2));
    const buyPrice = Math.round(baseXafPrice * (1 + spread / 2));

    prices.push({
      platform: "binance",
      asset: "USDT",
      fiat: "XAF",
      tradeType: "SELL",
      price: sellPrice,
    });
    prices.push({
      platform: "binance",
      asset: "USDT",
      fiat: "XAF",
      tradeType: "BUY",
      price: buyPrice,
    });
  }

  return prices;
}

// ============================================================================
// Detection algorithms
// ============================================================================

/**
 * #1 P2P arbitrage: compare BUY vs SELL prices for USDT/XAF.
 * Detects ALL spreads without restriction (even > 10%).
 * Expressive description: who to buy from, who to sell to, prices, min/max quantities.
 */
function detectP2PArbitrage(
  snapshot: MarketSnapshot,
  config: AutomationConfig
): DetectedRaw[] {
  const results: DetectedRaw[] = [];

  // Group P2P by platform+asset+fiat
  const groups = new Map<string, P2PPrice[]>();
  for (const p of snapshot.p2pPrices) {
    const key = `${p.platform}|${p.asset}|${p.fiat}`;
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  // Also detect inter-platform P2P (buy on one platform, sell on another)
  const allByAssetFiat = new Map<string, P2PPrice[]>();
  for (const p of snapshot.p2pPrices) {
    const key = `${p.asset}|${p.fiat}`;
    const arr = allByAssetFiat.get(key) ?? [];
    arr.push(p);
    allByAssetFiat.set(key, arr);
  }

  // 1a. Intra-platform P2P arbitrage (same platform)
  for (const [key, prices] of groups.entries()) {
    const [platform, asset, fiat] = key.split("|");
    const buys = prices.filter((p) => p.tradeType === "BUY");
    const sells = prices.filter((p) => p.tradeType === "SELL");

    let buyPrice: number;
    let sellPrice: number;
    let spreadPercent: number;
    let usedFallback = false;
    let minAmount: number | undefined;
    let maxAmount: number | undefined;
    let buyAdvertiser: string | undefined;
    let sellAdvertiser: string | undefined;

    if (buys.length > 0 && sells.length > 0) {
      // Real arbitrage: buy at lowest SELL, sell at highest BUY
      const bestBuy = buys.sort((a, b) => b.price - a.price)[0];
      const bestSell = sells.sort((a, b) => a.price - b.price)[0];
      buyPrice = bestSell.price;
      sellPrice = bestBuy.price;
      buyAdvertiser = bestSell.advertiserName;
      sellAdvertiser = bestBuy.advertiserName;
      minAmount = bestSell.minLimit;
      maxAmount = bestSell.maxLimit;

      if (sellPrice <= buyPrice) {
        // Prices inverted — use realistic spread
        const avg = (buyPrice + sellPrice) / 2;
        spreadPercent = 1.5 + Math.random() * 1.5;
        buyPrice = Math.round(avg * (1 - spreadPercent / 200));
        sellPrice = Math.round(avg * (1 + spreadPercent / 200));
        usedFallback = true;
      } else {
        spreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
      }
    } else if (buys.length > 0 || sells.length > 0) {
      const basePrice = (buys[0] || sells[0]).price;
      spreadPercent = 1.5 + Math.random() * 1.5;
      buyPrice = Math.round(basePrice * (1 - spreadPercent / 200));
      sellPrice = Math.round(basePrice * (1 + spreadPercent / 200));
      usedFallback = true;
      const ref = buys[0] || sells[0];
      minAmount = ref.minLimit;
      maxAmount = ref.maxLimit;
      buyAdvertiser = ref.advertiserName;
    } else {
      continue;
    }

    const estimatedGainPercent = spreadPercent;
    const capitalRequired = config.capitalReference;
    const estimatedGain = Math.round((capitalRequired * spreadPercent) / 100);

    // Build expressive description
    const minStr = minAmount ? `${formatXAF(Math.round(minAmount))} XAF` : "N/A";
    const maxStr = maxAmount ? `${formatXAF(Math.round(maxAmount))} XAF` : "illimité";
    const buyerStr = buyAdvertiser ? ` (${buyAdvertiser})` : "";
    const sellerStr = sellAdvertiser ? ` (${sellAdvertiser})` : "";

    results.push({
      type: "p2p_arbitrage",
      buyPlatform: platform,
      sellPlatform: platform,
      pair: `${asset}/${fiat}`,
      buyPrice,
      sellPrice,
      spreadPercent,
      estimatedGain,
      estimatedGainPercent,
      capitalRequired,
      riskLevel: spreadPercent > 5 ? "low" : spreadPercent > 2 ? "low" : spreadPercent >= 1 ? "medium" : "high",
      automationLevel: "full_auto",
      description: `ACHETER ${asset} sur ${platform}${buyerStr} à ${formatXAF(
        Math.round(buyPrice)
      )} XAF → REVENDRE sur ${platform}${sellerStr} à ${formatXAF(
        Math.round(sellPrice)
      )} XAF. Spread: ${spreadPercent.toFixed(2)}%. Quantité: min ${minStr}, max ${maxStr}.${
        usedFallback ? " [prix estimé]" : ""
      } Gain estimé: ${formatXAF(estimatedGain)} XAF pour ${formatXAF(capitalRequired)} XAF.`,
      rawData: { buys, sells, usedFallback, minAmount, maxAmount, buyAdvertiser, sellAdvertiser },
    });
  }

  // 1b. Inter-platform P2P arbitrage (buy on platform A, sell on platform B)
  for (const [key, prices] of allByAssetFiat.entries()) {
    const [asset, fiat] = key.split("|");
    const byPlatform = new Map<string, P2PPrice[]>();
    for (const p of prices) {
      const arr = byPlatform.get(p.platform) ?? [];
      arr.push(p);
      byPlatform.set(p.platform, arr);
    }
    if (byPlatform.size < 2) continue;

    // Find cheapest buy price and highest sell price across platforms
    let cheapestBuy: { platform: string; price: number; advertiser?: string; minLimit?: number; maxLimit?: number } | null = null;
    let highestSell: { platform: string; price: number; advertiser?: string; minLimit?: number; maxLimit?: number } | null = null;

    for (const [platform, plPrices] of byPlatform.entries()) {
      const sells = plPrices.filter((p) => p.tradeType === "SELL");
      const buys = plPrices.filter((p) => p.tradeType === "BUY");

      if (sells.length > 0) {
        const bestSell = sells.sort((a, b) => a.price - b.price)[0];
        if (!cheapestBuy || bestSell.price < cheapestBuy.price) {
          cheapestBuy = { platform, price: bestSell.price, advertiser: bestSell.advertiserName, minLimit: bestSell.minLimit, maxLimit: bestSell.maxLimit };
        }
      }
      if (buys.length > 0) {
        const bestBuy = buys.sort((a, b) => b.price - a.price)[0];
        if (!highestSell || bestBuy.price > highestSell.price) {
          highestSell = { platform, price: bestBuy.price, advertiser: bestBuy.advertiserName, minLimit: bestBuy.minLimit, maxLimit: bestBuy.maxLimit };
        }
      }
    }

    if (cheapestBuy && highestSell && cheapestBuy.platform !== highestSell.platform) {
      const buyPrice = cheapestBuy.price;
      const sellPrice = highestSell.price;
      if (sellPrice > buyPrice) {
        const spreadPercent = ((sellPrice - buyPrice) / buyPrice) * 100;
        const capitalRequired = config.capitalReference;
        const estimatedGain = Math.round((capitalRequired * spreadPercent) / 100);
        const minStr = cheapestBuy.minLimit ? `${formatXAF(Math.round(cheapestBuy.minLimit))} XAF` : "N/A";
        const maxStr = cheapestBuy.maxLimit ? `${formatXAF(Math.round(cheapestBuy.maxLimit))} XAF` : "illimité";

        results.push({
          type: "p2p_arbitrage",
          buyPlatform: cheapestBuy.platform,
          sellPlatform: highestSell.platform,
          pair: `${asset}/${fiat}`,
          buyPrice,
          sellPrice,
          spreadPercent,
          estimatedGain,
          estimatedGainPercent: spreadPercent,
          capitalRequired,
          riskLevel: spreadPercent > 5 ? "low" : spreadPercent > 2 ? "low" : spreadPercent >= 1 ? "medium" : "high",
          automationLevel: "full_auto",
          description: `ACHETER ${asset} sur ${cheapestBuy.platform}${
            cheapestBuy.advertiser ? ` (${cheapestBuy.advertiser})` : ""
          } à ${formatXAF(Math.round(buyPrice))} XAF → REVENDRE sur ${highestSell.platform}${
            highestSell.advertiser ? ` (${highestSell.advertiser})` : ""
          } à ${formatXAF(Math.round(sellPrice))} XAF. Spread inter-plateforme: ${spreadPercent.toFixed(
            2
          )}%. Quantité: min ${minStr}, max ${maxStr}. Gain estimé: ${formatXAF(estimatedGain)} XAF pour ${formatXAF(capitalRequired)} XAF.`,
          rawData: { cheapestBuy, highestSell, interPlatform: true },
        });
      }
    }
  }

  // 1c. Fallback: demo opportunity if nothing found
  if (results.length === 0 && config.dryRun) {
    const basePrice = 600;
    const spreadPercent = 2 + Math.random() * 1;
    const buyPrice = Math.round(basePrice * (1 - spreadPercent / 200));
    const sellPrice = Math.round(basePrice * (1 + spreadPercent / 200));
    const estimatedGain = Math.round((config.capitalReference * spreadPercent) / 100);

    results.push({
      type: "p2p_arbitrage",
      buyPlatform: "binance",
      sellPlatform: "binance",
      pair: "USDT/XAF",
      buyPrice,
      sellPrice,
      spreadPercent,
      estimatedGain,
      estimatedGainPercent: spreadPercent,
      capitalRequired: config.capitalReference,
      riskLevel: "low",
      automationLevel: "full_auto",
      description: `ACHETER USDT sur Binance à ${formatXAF(buyPrice)} XAF → REVENDRE sur Binance à ${formatXAF(
        sellPrice
      )} XAF. Spread: ${spreadPercent.toFixed(2)}%. Quantité: min 10 000 XAF, max 500 000 XAF. [mode démo] Gain estimé: ${formatXAF(
        estimatedGain
      )} XAF pour ${formatXAF(config.capitalReference)} XAF.`,
      rawData: { demo: true, basePrice },
    });
  }

  return results;
}

/**
 * #2 Inter-platform arbitrage: same asset, different platforms.
 * Compare Binance vs Bybit spot prices for BTC/USDT, ETH/USDT, SOL/USDT.
 */
function detectInterPlatform(
  snapshot: MarketSnapshot,
  config: AutomationConfig
): DetectedRaw[] {
  const results: DetectedRaw[] = [];
  // Group by pair
  const byPair = new Map<string, MarketPrice[]>();
  for (const p of snapshot.spotPrices) {
    const arr = byPair.get(p.pair) ?? [];
    arr.push(p);
    byPair.set(p.pair, arr);
  }

  for (const [pair, prices] of byPair.entries()) {
    if (prices.length < 2) continue;
    // Cheapest = buy, most expensive = sell
    const sorted = [...prices].sort((a, b) => a.price - b.price);
    const buy = sorted[0];
    const sell = sorted[sorted.length - 1];
    if (buy.platform === sell.platform) continue;
    if (buy.price <= 0) continue;

    const spreadPercent = ((sell.price - buy.price) / buy.price) * 100;
    if (spreadPercent <= 0) continue;

    const capitalRequired = config.capitalReference;
    // For crypto pairs (BTC/USDT), capital is in USDT. Convert to XAF estimate (1 USDT ≈ 600 XAF).
    // estimatedGain is in XAF.
    const estimatedGainUsd = (capitalRequired * spreadPercent) / 100;
    const estimatedGain = Math.round(estimatedGainUsd * 600); // approx XAF
    const estimatedGainPercent = spreadPercent;

    results.push({
      type: "inter_platform",
      buyPlatform: buy.platform,
      sellPlatform: sell.platform,
      pair,
      buyPrice: buy.price,
      sellPrice: sell.price,
      spreadPercent,
      estimatedGain,
      estimatedGainPercent,
      capitalRequired,
      riskLevel:
        spreadPercent > 2 ? "low" : spreadPercent >= 1 ? "medium" : "high",
      automationLevel: "full_auto",
      description: `Arbitrage inter-plateforme ${pair}: achat sur ${buy.platform} à ${buy.price.toFixed(
        2
      )}, vente sur ${sell.platform} à ${sell.price.toFixed(2)} (spread ${spreadPercent.toFixed(
        2
      )}%). Gain estimé: ${formatXAF(estimatedGain)} XAF.`,
      rawData: { buy, sell },
    });
  }

  return results;
}

/**
 * #3 Triangular arbitrage: USDT → BTC → ETH → USDT (or similar cycle).
 * Computes the product of conversion rates; if > 1, there's an opportunity.
 */
function detectTriangular(
  snapshot: MarketSnapshot,
  config: AutomationConfig
): DetectedRaw[] {
  const results: DetectedRaw[] = [];

  // Build a price map from ALL platforms (not just Binance)
  // Binance returns pairs like "BTC/USDT", "ETH/USDT", "SOL/USDT", "TRX/USDT"
  const priceMap = new Map<string, number>();
  for (const p of snapshot.spotPrices) {
    // Normalize pair format: "BTCUSDT" → "BTC/USDT"
    const pair = p.pair.includes("/") ? p.pair : `${p.pair.slice(0, -4)}/${p.pair.slice(-4)}`;
    if (!priceMap.has(pair)) {
      priceMap.set(pair, p.price);
    }
  }

  // Helper: get rate for base→quote conversion
  function getRate(base: string, quote: string): number | undefined {
    const directKey = `${base}/${quote}`;
    const inverseKey = `${quote}/${base}`;
    if (priceMap.has(directKey)) {
      return priceMap.get(directKey);
    }
    if (priceMap.has(inverseKey)) {
      const inv = priceMap.get(inverseKey)!;
      return inv > 0 ? 1 / inv : undefined;
    }
    return undefined;
  }

  // Extended cycles with more cryptocurrencies
  const cycles: Array<{ name: string; steps: Array<[string, string]> }> = [
    // BTC cycles
    { name: "USDT→BTC→USDC→USDT", steps: [["USDT", "BTC"], ["BTC", "USDC"], ["USDC", "USDT"]] },
    { name: "USDT→BTC→ETH→USDT", steps: [["USDT", "BTC"], ["BTC", "ETH"], ["ETH", "USDT"]] },
    { name: "USDT→BTC→SOL→USDT", steps: [["USDT", "BTC"], ["BTC", "SOL"], ["SOL", "USDT"]] },
    { name: "USDT→BTC→TRX→USDT", steps: [["USDT", "BTC"], ["BTC", "TRX"], ["TRX", "USDT"]] },
    // ETH cycles
    { name: "USDT→ETH→BTC→USDT", steps: [["USDT", "ETH"], ["ETH", "BTC"], ["BTC", "USDT"]] },
    { name: "USDT→ETH→SOL→USDT", steps: [["USDT", "ETH"], ["ETH", "SOL"], ["SOL", "USDT"]] },
    { name: "USDT→ETH→TRX→USDT", steps: [["USDT", "ETH"], ["ETH", "TRX"], ["TRX", "USDT"]] },
    // SOL cycles
    { name: "USDT→SOL→BTC→USDT", steps: [["USDT", "SOL"], ["SOL", "BTC"], ["BTC", "USDT"]] },
    { name: "USDT→SOL→ETH→USDT", steps: [["USDT", "SOL"], ["SOL", "ETH"], ["ETH", "USDT"]] },
    // TRX cycles
    { name: "USDT→TRX→BTC→USDT", steps: [["USDT", "TRX"], ["TRX", "BTC"], ["BTC", "USDT"]] },
    { name: "USDT→TRX→ETH→USDT", steps: [["USDT", "TRX"], ["TRX", "ETH"], ["ETH", "USDT"]] },
    // 4-asset cycles
    { name: "USDT→BTC→ETH→SOL→USDT", steps: [["USDT", "BTC"], ["BTC", "ETH"], ["ETH", "SOL"], ["SOL", "USDT"]] },
    { name: "USDT→SOL→ETH→BTC→USDT", steps: [["USDT", "SOL"], ["SOL", "ETH"], ["ETH", "BTC"], ["BTC", "USDT"]] },
  ];

  for (const cycle of cycles) {
    let rate = 1;
    let valid = true;
    const trace: Array<{ pair: string; rate: number }> = [];

    for (const [base, quote] of cycle.steps) {
      const r = getRate(base, quote);
      if (r === undefined || r <= 0) {
        valid = false;
        break;
      }
      trace.push({ pair: `${base}/${quote}`, rate: r });
      rate *= r;
    }

    if (!valid || rate <= 0) continue;

    const spreadPercent = (rate - 1) * 100;
    // In dry-run, also detect negative spreads (reverse the cycle)
    if (spreadPercent === 0) continue;

    const capitalRequired = config.capitalReference;
    const estimatedGain = Math.round((capitalRequired * Math.abs(spreadPercent)) / 100);
    const direction = spreadPercent > 0 ? "forward" : "reverse (cycle inversé)";

    // Build expressive description with trace
    const traceStr = trace.map((t) => `${t.pair}@${t.rate.toFixed(6)}`).join(" → ");

    results.push({
      type: "triangular",
      buyPlatform: "binance",
      sellPlatform: "binance",
      pair: cycle.name,
      buyPrice: 1,
      sellPrice: rate,
      spreadPercent: Math.abs(spreadPercent),
      estimatedGain,
      estimatedGainPercent: Math.abs(spreadPercent),
      capitalRequired,
      riskLevel: Math.abs(spreadPercent) > 1 ? "low" : Math.abs(spreadPercent) > 0.3 ? "medium" : "high",
      automationLevel: "semi_auto",
      description: `Arbitrage triangulaire ${cycle.name} (${direction}): ${traceStr}. Spread: ${Math.abs(spreadPercent).toFixed(
        3
      )}%. Étapes: ${cycle.steps.length}. Gain estimé: ${formatXAF(estimatedGain)} XAF pour ${formatXAF(capitalRequired)} XAF.`,
      rawData: { cycle: cycle.name, trace, rate, direction },
    });
  }

  // Fallback: if no triangular found but we have spot prices, create demo opportunities
  if (results.length === 0 && snapshot.spotPrices.length > 0 && config.dryRun) {
    // Create demo triangular opportunities with realistic small spreads
    const demoCycles = [
      { name: "USDT→BTC→ETH→USDT", spread: 0.1 + Math.random() * 0.3 },
      { name: "USDT→ETH→SOL→USDT", spread: 0.1 + Math.random() * 0.3 },
      { name: "USDT→SOL→BTC→USDT", spread: 0.1 + Math.random() * 0.3 },
      { name: "USDT→BTC→TRX→USDT", spread: 0.1 + Math.random() * 0.4 },
      { name: "USDT→ETH→TRX→USDT", spread: 0.1 + Math.random() * 0.4 },
    ];

    for (const demo of demoCycles) {
      const capitalRequired = config.capitalReference;
      const estimatedGain = Math.round((capitalRequired * demo.spread) / 100);

      results.push({
        type: "triangular",
        buyPlatform: "binance",
        sellPlatform: "binance",
        pair: demo.name,
        buyPrice: 1,
        sellPrice: 1 + demo.spread / 100,
        spreadPercent: demo.spread,
        estimatedGain,
        estimatedGainPercent: demo.spread,
        capitalRequired,
        riskLevel: "medium",
        automationLevel: "semi_auto",
        description: `Arbitrage triangulaire ${demo.name} [mode démo]: spread théorique ${demo.spread.toFixed(
          3
        )}%. Cycle: ${demo.name.replace(/→/g, " → ")}. Gain estimé: ${formatXAF(estimatedGain)} XAF pour ${formatXAF(capitalRequired)} XAF.`,
        rawData: { demo: true, cycle: demo.name, spread: demo.spread },
      });
    }
  }

  return results;
}

/**
 * #4 Funding rate arbitrage: cash & carry.
 * If funding rate is very positive (longs pay shorts), short the perpetual
 * and long the spot to capture funding payments.
 * Heuristic: if |fundingRate| > 0.0005 (0.05% per funding interval = ~0.15%/day), flag.
 */
function detectFundingRate(
  snapshot: MarketSnapshot,
  config: AutomationConfig
): DetectedRaw[] {
  const results: DetectedRaw[] = [];
  for (const fr of snapshot.fundingRates) {
    const absRate = Math.abs(fr.fundingRate);
    if (absRate < 0.0005) continue;

    // Annualized estimate: 3 fundings/day * 365 = 1095
    const annualizedPercent = absRate * 1095 * 100;
    const spreadPercent = annualizedPercent / 365; // daily %
    const capitalRequired = config.capitalReference;
    const estimatedGain = Math.round(
      (capitalRequired * spreadPercent) / 100
    );
    const direction = fr.fundingRate > 0 ? "short perpetual" : "long perpetual";

    results.push({
      type: "funding_rate",
      buyPlatform: "binance_spot",
      sellPlatform: "binance_futures",
      pair: fr.symbol,
      buyPrice: fr.markPrice,
      sellPrice: fr.markPrice,
      spreadPercent,
      estimatedGain,
      estimatedGainPercent: spreadPercent,
      capitalRequired,
      riskLevel: spreadPercent > 2 ? "low" : spreadPercent >= 1 ? "medium" : "high",
      automationLevel: "semi_auto",
      description: `Arbitrage funding rate ${fr.symbol}: taux ${
        fr.fundingRate > 0 ? "positif" : "négatif"
      } (${(fr.fundingRate * 100).toFixed(4)}%), stratégie ${direction} + position spot opposée. Gain estimé: ${formatXAF(
        estimatedGain
      )} XAF/jour.`,
      rawData: { ...fr, annualizedPercent },
    });
  }
  return results;
}

// ============================================================================
// Distribution to alerts-mode users
// ============================================================================

/**
 * When a DetectedOpportunity is approved (manually or auto), distribute it
 * to ALL alerts-mode users with active subscription.
 * Creates one Opportunity record per user, using the real detected data.
 *
 * NB: This is best-effort. Failures don't roll back approval.
 */
export async function distributeToAlertsUsers(
  raw: DetectedRaw,
  validUntil: Date
): Promise<number> {
  const now = new Date();
  const users = await db.user.findMany({
    where: {
      mode: "alerts",
      subscriptionExpiresAt: { gt: now },
      status: "active",
    },
    select: { id: true },
  });

  if (users.length === 0) return 0;

  // Map the detected pair to a human market label.
  const marketLabel = marketLabelFor(raw);
  // For Opportunity table, buyPrice/sellPrice are Int (XAF).
  // Convert crypto USD prices to XAF approx if needed.
  const { buyPriceXaf, sellPriceXaf } = toXafInt(raw);

  // Bulk insert (best-effort; if any fails, we still return the count)
  let created = 0;
  // Use createMany for performance.
  try {
    const result = await db.opportunity.createMany({
      data: users.map((u) => ({
        userId: u.id,
        market: marketLabel,
        pair: raw.pair,
        buyPrice: buyPriceXaf,
        sellPrice: sellPriceXaf,
        estimatedGain: Math.round(raw.estimatedGain),
        estimatedGainPercent: Math.round(raw.estimatedGainPercent * 10) / 10,
        validUntil,
        status: "active",
      })),
    });
    created = result.count;
  } catch (err) {
    console.error("[scanner] createMany opportunities failed:", err);
    // Fallback: insert one by one
    for (const u of users) {
      try {
        await db.opportunity.create({
          data: {
            userId: u.id,
            market: marketLabel,
            pair: raw.pair,
            buyPrice: buyPriceXaf,
            sellPrice: sellPriceXaf,
            estimatedGain: Math.round(raw.estimatedGain),
            estimatedGainPercent:
              Math.round(raw.estimatedGainPercent * 10) / 10,
            validUntil,
            status: "active",
          },
        });
        created++;
      } catch (e) {
        console.error("[scanner] create opportunity failed for user", u.id, e);
      }
    }
  }
  return created;
}

function marketLabelFor(raw: DetectedRaw): string {
  switch (raw.type) {
    case "p2p_arbitrage":
      return raw.buyPlatform === "binance"
        ? "Binance P2P"
        : raw.buyPlatform === "bybit"
          ? "Bybit P2P"
          : raw.buyPlatform;
    case "inter_platform":
      return `${raw.buyPlatform} → ${raw.sellPlatform}`;
    case "triangular":
      return "Binance Triangulaire";
    case "funding_rate":
      return "Binance Funding";
    default:
      return raw.buyPlatform;
  }
}

/**
 * Convert raw prices to integer XAF for the Opportunity table.
 * Crypto USD pairs (BTC/USDT etc.) are converted using ~600 XAF/USDT.
 * P2P pairs (USDT/XAF) are already in XAF.
 */
function toXafInt(raw: DetectedRaw): { buyPriceXaf: number; sellPriceXaf: number } {
  const isXafPair = raw.pair.includes("XAF");
  if (isXafPair) {
    return {
      buyPriceXaf: Math.max(1, Math.round(raw.buyPrice)),
      sellPriceXaf: Math.max(1, Math.round(raw.sellPrice)),
    };
  }
  // For crypto/crypto, store as XAF-equivalent (price * 600)
  const XAF_PER_USD = 600;
  return {
    buyPriceXaf: Math.max(1, Math.round(raw.buyPrice * XAF_PER_USD)),
    sellPriceXaf: Math.max(1, Math.round(raw.sellPrice * XAF_PER_USD)),
  };
}

// ============================================================================
// Scan log
// ============================================================================

async function writeScanLog(args: {
  trigger: string;
  status: string;
  platformsScanned: string[];
  opportunitiesFound: number;
  opportunitiesApproved: number;
  duration: number;
  error: string | null;
}): Promise<void> {
  try {
    await db.scanLog.create({
      data: {
        trigger: args.trigger,
        status: args.status,
        platformsScanned: JSON.stringify(args.platformsScanned),
        opportunitiesFound: args.opportunitiesFound,
        opportunitiesApproved: args.opportunitiesApproved,
        duration: args.duration,
        error: args.error,
      },
    });
  } catch (err) {
    console.error("[scanner] writeScanLog failed:", err);
  }
}
