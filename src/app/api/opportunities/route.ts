// CashPilot - Flux d'opportunités (mode alerts)
// GET /api/opportunities?userId=xxx
// Retourne les opportunités actives de l'utilisateur et en génère de nouvelles si besoin.
//
// Logique:
// 1. Si l'utilisateur n'est pas en mode "alerts" ou abonnement inactif → liste vide (ok:true).
// 2. Marque comme "expired" les opportunités actives dont validUntil est dépassé.
// 3. Si moins de N opportunités actives (config.minActiveToGenerate), en génère 1-2 nouvelles
//    (sans dépasser config.maxActive au total).
// 4. Retourne les opportunités actives (createdAt desc) + statistiques.
//
// Tous les paramètres (marchés, paires, plages de prix, spread, validité, capital de référence,
// seuils de génération) proviennent de la configuration admin (getOpportunitiesConfig).

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isToday } from "@/lib/utils";
import { getOpportunitiesConfig } from "@/lib/config-server";
import type { OpportunitiesConfig } from "@/lib/config-defaults";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Plages de prix d'achat par paire, dérivées de la config.
// Chaque paire a sa propre plage configurable depuis l'admin.
function buyPriceRangeFor(
  pair: string,
  cfg: OpportunitiesConfig
): { min: number; max: number } {
  switch (pair) {
    case "BTC/XAF":
      return { min: cfg.btcPriceLow, max: cfg.btcPriceHigh };
    case "USDC/XAF":
      return { min: cfg.usdcPriceLow, max: cfg.usdcPriceHigh };
    case "ETH/XAF":
      return { min: cfg.ethPriceLow, max: cfg.ethPriceHigh };
    case "TRX/XAF":
      return { min: cfg.trxPriceLow, max: cfg.trxPriceHigh };
    case "SOL/XAF":
      return { min: cfg.solPriceLow, max: cfg.solPriceHigh };
    case "USDT/XAF":
    default:
      return { min: cfg.usdtPriceLow, max: cfg.usdtPriceHigh };
  }
}

function generateOpportunityData(cfg: OpportunitiesConfig) {
  const market = pickRandom(cfg.markets);
  const pair = pickRandom(cfg.pairs);
  const range = buyPriceRangeFor(pair, cfg);
  const buyPrice = randomInt(range.min, range.max);

  // Spread entre spreadLow et spreadHigh (ex: 1% à 4%)
  const spread = cfg.spreadLow + Math.random() * (cfg.spreadHigh - cfg.spreadLow);
  const sellPrice = Math.round(buyPrice * (1 + spread));

  const estimatedGainPercent = Math.round(spread * 100 * 10) / 10; // 1 décimale
  const estimatedGain = Math.round(cfg.referenceCapital * spread);

  const validMinutes = randomInt(cfg.validUntilMinMin, cfg.validUntilMaxMin);
  const now = new Date();
  const validUntil = new Date(now.getTime() + validMinutes * 60 * 1000);

  return {
    market,
    pair,
    buyPrice,
    sellPrice,
    estimatedGain,
    estimatedGainPercent,
    validUntil,
  };
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Identifiant requis." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Compte introuvable." },
        { status: 404 }
      );
    }

    // 1. Vérifier le mode + abonnement actif
    const now = new Date();
    const subscriptionActive =
      user.mode === "alerts" &&
      !!user.subscriptionExpiresAt &&
      user.subscriptionExpiresAt.getTime() > now.getTime();

    if (!subscriptionActive) {
      // Pas en mode alerts ou abonnement inactif: liste vide.
      return NextResponse.json({
        ok: true,
        opportunities: [],
        stats: {
          todayCount: 0,
          totalReceived: 0,
          totalExecuted: 0,
        },
      });
    }

    // Charger la configuration des opportunités (admin-editable)
    const cfg = await getOpportunitiesConfig();

    // 2. Expirer les opportunités dont la validité est dépassée
    await db.opportunity.updateMany({
      where: {
        userId,
        status: "active",
        validUntil: { lt: now },
      },
      data: { status: "expired" },
    });

    // 3. Compter les actives et générer si besoin
    const activeCount = await db.opportunity.count({
      where: { userId, status: "active" },
    });

    if (activeCount < cfg.minActiveToGenerate) {
      // Générer 1 ou 2 nouvelles opportunités, sans dépasser cfg.maxActive au total.
      const desired = Math.random() < 0.5 ? 1 : 2;
      const toGenerate = Math.min(desired, cfg.maxActive - activeCount);

      for (let i = 0; i < toGenerate; i++) {
        const data = generateOpportunityData(cfg);
        await db.opportunity.create({
          data: {
            userId,
            market: data.market,
            pair: data.pair,
            buyPrice: data.buyPrice,
            sellPrice: data.sellPrice,
            estimatedGain: data.estimatedGain,
            estimatedGainPercent: data.estimatedGainPercent,
            validUntil: data.validUntil,
            status: "active",
          },
        });
      }
    }

    // 4. Récupérer toutes les opportunités actives, récentes d'abord
    const activeOpportunities = await db.opportunity.findMany({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    // 5. Statistiques
    const allOpportunities = await db.opportunity.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const todayCount = allOpportunities.filter((o) =>
      isToday(o.createdAt.toISOString())
    ).length;
    const totalReceived = allOpportunities.length;
    const totalExecuted = allOpportunities.filter(
      (o) => o.status === "executed"
    ).length;

    // 6. Réponse
    return NextResponse.json({
      ok: true,
      opportunities: activeOpportunities.map((o) => ({
        id: o.id,
        market: o.market,
        pair: o.pair,
        buyPrice: o.buyPrice,
        sellPrice: o.sellPrice,
        estimatedGain: o.estimatedGain,
        estimatedGainPercent: o.estimatedGainPercent,
        validUntil: o.validUntil.toISOString(),
        status: o.status,
        createdAt: o.createdAt.toISOString(),
      })),
      stats: {
        todayCount,
        totalReceived,
        totalExecuted,
      },
    });
  } catch (err) {
    console.error("[opportunities] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
