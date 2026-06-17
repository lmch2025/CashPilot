// CashPilot - Robot tick: simule l'arbitrage P2P et génère des gains
// POST /api/robot/tick
// Body: { userId: string }
// Le robot ne génère un gain que si l'utilisateur a du capital et est actif.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatXAF } from "@/lib/utils";

const MARKETS = [
  { name: "Binance P2P", pair: "USDT/XAF" },
  { name: "Yellow Card", pair: "USDT/XAF" },
  { name: "Paxful", pair: "BTC/XAF" },
  { name: "Bitget", pair: "USDT/XAF" },
];

// Description simples et humaines des opérations
const HUMAN_DESCRIPTIONS = [
  "Échange automatique réussi",
  "Opération sur Binance P2P",
  "Achat et revente instantanée",
  "Arbitrage entre deux marchés",
  "Opportunité détectée et exécutée",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body as { userId: string };

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

    // Le robot ne travaille que si l'utilisateur a du capital et est actif
    if (user.status !== "active" || user.capital <= 0) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Robot inactif (pas de capital ou compte en pause).",
      });
    }

    // Calcul du gain potentiel
    // Rendement quotidien indicatif: 0.6% à 1.6% du capital
    // On fait un tick toutes les ~20-40s en démo, donc gain par tick très petit
    // Pour un capital de 50000 XAF: 0.6-1.6%/jour = 300-800 XAF/jour
    // Tick = ~300-800 / ~150 ticks par jour = 2-6 XAF par tick
    // Mais on veut que ce soit visible, donc on multiplie par 4-5 pour la démo
    const dailyRateLow = 0.006;
    const dailyRateHigh = 0.016;
    const ticksPerDay = 150;
    const demoMultiplier = 4; // pour rendre la démo plus visible

    const baseLow = (user.capital * dailyRateLow) / ticksPerDay;
    const baseHigh = (user.capital * dailyRateHigh) / ticksPerDay;
    const gain = Math.max(
      5,
      Math.round(
        (baseLow + Math.random() * (baseHigh - baseLow)) * demoMultiplier
      )
    );

    // 85% de chance de réussite (parfois le robot ne fait rien)
    if (Math.random() > 0.85) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Aucune opportunité rentable pour le moment.",
      });
    }

    const market = MARKETS[Math.floor(Math.random() * MARKETS.length)];
    const description =
      HUMAN_DESCRIPTIONS[Math.floor(Math.random() * HUMAN_DESCRIPTIONS.length)] +
      ` — gain : ${formatXAF(gain)} XAF`;

    const newBalance = user.balance + gain;
    const newTotalGains = user.totalGains + gain;
    const newTotalExchanges = user.totalExchanges + 1;

    const [robotEvent, transaction] = await db.$transaction([
      db.robotEvent.create({
        data: {
          userId,
          gain,
          market: market.name,
          pair: market.pair,
        },
      }),
      db.transaction.create({
        data: {
          userId,
          type: "gain",
          amount: gain,
          balanceAfter: newBalance,
          description,
        },
      }),
      db.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          totalGains: newTotalGains,
          totalExchanges: newTotalExchanges,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      acted: true,
      gain,
      balance: newBalance,
      totalGains: newTotalGains,
      totalExchanges: newTotalExchanges,
      market: market.name,
      pair: market.pair,
      description,
      createdAt: transaction.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("[robot/tick] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
