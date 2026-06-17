// CashPilot - Dashboard
// GET /api/dashboard?userId=xxx
// Retourne toutes les données nécessaires au tableau de bord

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isToday } from "@/lib/utils";

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

    // Transactions récentes (20 dernières)
    const recentTransactions = await db.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Gains du jour
    const todayGainTx = await db.transaction.findMany({
      where: {
        userId,
        type: "gain",
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const todayGains = todayGainTx
      .filter((t) => isToday(t.createdAt.toISOString()))
      .reduce((sum, t) => sum + t.amount, 0);
    const todayExchanges = todayGainTx.filter((t) =>
      isToday(t.createdAt.toISOString())
    ).length;

    // Dernier échange (robot event)
    const lastRobotEvent = await db.robotEvent.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Historique des gains pour le graphique (24 derniers points)
    // On agrège par heure pour les 24 dernières heures
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const gainEvents = await db.transaction.findMany({
      where: {
        userId,
        type: "gain",
        createdAt: { gte: dayAgo },
      },
      orderBy: { createdAt: "asc" },
    });

    // Construire un graphique cumulatif sur 24h
    const buckets: { time: string; value: number }[] = [];
    const bucketSizeMs = 60 * 60 * 1000; // 1 heure
    const startBucket = new Date(
      Math.floor(dayAgo.getTime() / bucketSizeMs) * bucketSizeMs
    );
    let cumulative = 0;
    for (let i = 0; i < 24; i++) {
      const bucketStart = new Date(startBucket.getTime() + i * bucketSizeMs);
      const bucketEnd = new Date(bucketStart.getTime() + bucketSizeMs);
      const bucketGains = gainEvents
        .filter((t) => {
          const tTime = t.createdAt.getTime();
          return tTime >= bucketStart.getTime() && tTime < bucketEnd.getTime();
        })
        .reduce((sum, t) => sum + t.amount, 0);
      cumulative += bucketGains;
      buckets.push({
        time: bucketStart.toISOString(),
        value: cumulative,
      });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        level: user.level,
        balance: user.balance,
        capital: user.capital,
        totalGains: user.totalGains,
        totalExchanges: user.totalExchanges,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      todayGains,
      todayExchanges,
      lastExchange: lastRobotEvent
        ? {
            gain: lastRobotEvent.gain,
            market: lastRobotEvent.market,
            pair: lastRobotEvent.pair,
            createdAt: lastRobotEvent.createdAt.toISOString(),
          }
        : null,
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        operator: t.operator,
        createdAt: t.createdAt.toISOString(),
      })),
      gainsHistory: buckets,
    });
  } catch (err) {
    console.error("[dashboard] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
