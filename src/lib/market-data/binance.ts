// CashPilot - Binance market data fetcher
// Récupère les vraies données de marché depuis les APIs publiques Binance.
//
// Endpoints utilisés (aucune authentification requise pour les endpoints publics):
//  - Spot 24h ticker: https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT
//  - P2P search:      https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search (POST)
//  - Funding rate:    https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT
//
// Notes:
//  - Tous les appels HTTP ont un timeout de 8s (AbortController) — Vercel hobby = 10s max.
//  - Si config.useScraperForGeoblocked && config.scraperApiKey, on route via ScraperApi
//    (contourne les blocages géo et le rate-limit).
//  - Les erreurs d'un endpoint ne font jamais crasher le fetcher: on log et on renvoie [].

import { db } from "@/lib/db";
import type { AutomationConfig } from "@/lib/config-defaults";
import type { MarketPrice, P2PPrice, FundingRate } from "./types";

const SPOT_ENDPOINT = "https://api.binance.com/api/v3/ticker/24hr";
const P2P_ENDPOINT = "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";
const FUNDING_ENDPOINT = "https://fapi.binance.com/fapi/v1/premiumIndex";

const SPOT_SYMBOLS = ["BTCUSDT", "ETHUSDT", "TRXUSDT", "SOLUSDT", "USDCUSDT"];
const FUNDING_SYMBOLS = ["BTCUSDT", "ETHUSDT"];

const TIMEOUT_MS = 8000;

/**
 * Build the final URL, optionally wrapped via ScraperApi.
 * ScraperApi format: https://api.scraperapi.com/?api_key=KEY&url=ENCODED_URL
 */
function buildUrl(url: string, config: AutomationConfig): string {
  if (config.useScraperForGeoblocked && config.scraperApiKey) {
    return `https://api.scraperapi.com/?api_key=${encodeURIComponent(
      config.scraperApiKey
    )}&url=${encodeURIComponent(url)}`;
  }
  return url;
}

/**
 * Fetch helper with timeout. Throws on error or timeout.
 */
async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        // Binance P2P requires JSON content-type + a user-agent or it 415s.
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        ...(init?.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Persist a single MarketData row. Best-effort: never throws.
 */
async function persistMarketData(
  platform: string,
  pair: string,
  price: number,
  extra: {
    bid?: number;
    ask?: number;
    volume24h?: number;
    rawData?: unknown;
  } = {}
): Promise<void> {
  try {
    await db.marketData.create({
      data: {
        platform,
        pair,
        price,
        bid: extra.bid ?? null,
        ask: extra.ask ?? null,
        volume24h: extra.volume24h ?? null,
        rawData: extra.rawData ? JSON.stringify(extra.rawData) : null,
      },
    });
  } catch (err) {
    // Ne jamais crasher sur l'écriture DB (Neon peut être indisponible).
    console.error(`[binance] persistMarketData(${platform}, ${pair}) error:`, err);
  }
}

/**
 * Fetch spot 24h tickers for the configured symbols.
 * Endpoint: GET /api/v3/ticker/24hr?symbol=BTCUSDT (one call per symbol for safety).
 */
export async function fetchBinanceSpotPrices(
  config: AutomationConfig
): Promise<MarketPrice[]> {
  const results: MarketPrice[] = [];

  // Fetch all symbols in parallel — but wrap each call so one failure
  // doesn't break the rest.
  const settled = await Promise.allSettled(
    SPOT_SYMBOLS.map(async (symbol) => {
      const url = buildUrl(`${SPOT_ENDPOINT}?symbol=${symbol}`, config);
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Binance spot ${symbol} HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        symbol: string;
        lastPrice: string;
        bidPrice: string;
        askPrice: string;
        volume: string;
        quoteVolume: string;
      };
      const price = parseFloat(data.lastPrice);
      const bid = parseFloat(data.bidPrice);
      const ask = parseFloat(data.askPrice);
      const volume24h = parseFloat(data.quoteVolume);

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error(`Binance spot ${symbol} prix invalide: ${data.lastPrice}`);
      }

      const pair = symbolToPair(symbol); // BTCUSDT → BTC/USDT
      const marketPrice: MarketPrice = {
        platform: "binance",
        pair,
        price,
        bid,
        ask,
        volume24h,
      };
      await persistMarketData("binance", pair, price, {
        bid,
        ask,
        volume24h,
        rawData: data,
      });
      return marketPrice;
    })
  );

  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      console.error(
        `[binance] spot ${SPOT_SYMBOLS[i]} failed:`,
        (s.reason as Error)?.message ?? s.reason
      );
    }
  }

  return results;
}

/**
 * Fetch P2P prices for a given asset/fiat pair (ex: USDT/XAF).
 * Returns both BUY and SELL quotes (2 POST calls).
 */
export async function fetchBinanceP2PPrices(
  asset: string,
  fiat: string,
  config: AutomationConfig
): Promise<P2PPrice[]> {
  const tradeTypes: Array<"BUY" | "SELL"> = ["BUY", "SELL"];

  const settled = await Promise.allSettled(
    tradeTypes.map(async (tradeType): Promise<P2PPrice[]> => {
      const body = {
        asset,
        fiat,
        page: 1,
        rows: 5,
        tradeType,
        payTypes: [],
        publishers: null,
        merchantCheck: false,
      };
      const url = buildUrl(P2P_ENDPOINT, config);
      const res = await fetchWithTimeout(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(
          `Binance P2P ${asset}/${fiat} ${tradeType} HTTP ${res.status}`
        );
      }
      const data = (await res.json()) as {
        success: boolean;
        data?: Array<{
          adv: {
            price: string;
            surplusAmount: string;
            minSingleTransAmount: string;
            maxSingleTransAmount: string;
            tradeMethods?: Array<{ identifier: string; tradeMethodName: string }>;
          };
          advertiser?: {
            nickName: string;
          };
        }>;
      };

      if (!data.success || !data.data || data.data.length === 0) {
        return [];
      }

      const p2pPrices: P2PPrice[] = data.data.slice(0, 3).map((row) => ({
        platform: "binance",
        asset,
        fiat,
        tradeType,
        price: parseFloat(row.adv.price),
        availableAmount: parseFloat(row.adv.surplusAmount),
        minLimit: parseFloat(row.adv.minSingleTransAmount),
        maxLimit: parseFloat(row.adv.maxSingleTransAmount),
        advertiserName: row.advertiser?.nickName,
        paymentMethods: row.adv.tradeMethods?.map((m) => m.tradeMethodName) ?? [],
      }));

      // Persist the first quote (best price) for monitoring.
      if (p2pPrices.length > 0) {
        const best = p2pPrices[0];
        const pair = `${asset}/${fiat}`;
        await persistMarketData("binance_p2p", pair, best.price, {
          rawData: { ...best, tradeType },
        });
      }

      return p2pPrices;
    })
  );

  const results: P2PPrice[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(...s.value);
    } else {
      console.error(
        `[binance] P2P ${asset}/${fiat} ${tradeTypes[i]} failed:`,
        (s.reason as Error)?.message ?? s.reason
      );
    }
  }
  return results;
}

/**
 * Fetch funding rates (premiumIndex) for perpetual futures.
 * Used for cash & carry / basis trade detection.
 */
export async function fetchBinanceFundingRates(
  config: AutomationConfig
): Promise<FundingRate[]> {
  const settled = await Promise.allSettled(
    FUNDING_SYMBOLS.map(async (symbol): Promise<FundingRate> => {
      const url = buildUrl(`${FUNDING_ENDPOINT}?symbol=${symbol}`, config);
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`Binance funding ${symbol} HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        symbol: string;
        markPrice: string;
        lastFundingRate: string;
        nextFundingTime: number;
        time: number;
      };
      const markPrice = parseFloat(data.markPrice);
      const fundingRate = parseFloat(data.lastFundingRate);
      if (!Number.isFinite(markPrice) || markPrice <= 0) {
        throw new Error(`Binance funding ${symbol} markPrice invalide`);
      }
      const fr: FundingRate = {
        platform: "binance",
        symbol,
        fundingRate,
        markPrice,
        nextFundingTime: data.nextFundingTime,
      };
      // Persist as market data (for dashboard live view)
      await persistMarketData("binance_funding", symbol, markPrice, {
        rawData: fr,
      });
      return fr;
    })
  );

  const results: FundingRate[] = [];
  for (let i = 0; i < settled.length; i++) {
    const s = settled[i];
    if (s.status === "fulfilled") {
      results.push(s.value);
    } else {
      console.error(
        `[binance] funding ${FUNDING_SYMBOLS[i]} failed:`,
        (s.reason as Error)?.message ?? s.reason
      );
    }
  }
  return results;
}

// === Helpers ===

/** BTCUSDT → BTC/USDT. Assumes base ends where quote starts. */
function symbolToPair(symbol: string): string {
  const quotes = ["USDT", "USDC", "BUSD", "BTC", "ETH", "BNB", "XAF"];
  for (const q of quotes) {
    if (symbol.endsWith(q)) {
      return `${symbol.slice(0, -q.length)}/${q}`;
    }
  }
  return symbol;
}
