// CashPilot - Robot tick: distribution basée sur le pool
// POST /api/robot/tick
// Body: { userId: string }
//
// Algorithme (distribution pool-based):
// 1. Trouver l'utilisateur déclencheur (mode managed + actif + capital > 0)
// 2. Anti double-distribution: respecter minIntervalSec
// 3. Charger TOUS les utilisateurs managed actifs avec capital > 0
// 4. Calculer le capital total du pool
// 5. Générer UN bénéfice réel basé sur le capital TOTAL (pas par utilisateur)
// 6. Appliquer le taux d'exposition (exposureRate) → exposedProfit + hiddenRetention
// 7. Appliquer la commission (commissionRate) → commission + distributable
// 8. Distribuer le distributable à chaque utilisateur prorata son capital
// 9. Transaction atomique: maj soldes + Transactions + RobotEvents + état distribution

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatXAF } from "@/lib/utils";
import {
  getRobotConfig,
  getDistributionConfig,
  getDistributionState,
} from "@/lib/config-server";
import type { DistributionState } from "@/lib/config-defaults";

const MARKETS = [
  { name: "Binance P2P", pair: "USDT/XAF" },
  { name: "Yellow Card", pair: "USDT/XAF" },
  { name: "Paxful", pair: "BTC/XAF" },
  { name: "Bitget", pair: "USDT/XAF" },
  { name: "KuCoin P2P", pair: "USDC/XAF" },
  { name: "OKX P2P", pair: "ETH/XAF" },
  { name: "Remitano", pair: "TRX/XAF" },
  { name: "Bybit P2P", pair: "SOL/XAF" },
];

function applyRounding(
  value: number,
  mode: "floor" | "round" | "ceil"
): number {
  if (mode === "floor") return Math.floor(value);
  if (mode === "ceil") return Math.ceil(value);
  return Math.round(value);
}

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

    // 1. Trouver l'utilisateur déclencheur
    const triggeringUser = await db.user.findUnique({
      where: { id: userId },
    });
    if (!triggeringUser) {
      return NextResponse.json(
        { ok: false, error: "Compte introuvable." },
        { status: 404 }
      );
    }

    // Le robot ne travaille que pour les comptes en mode "managed"
    if (triggeringUser.mode !== "managed") {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Mode alerts: le robot ne gère pas directement l'argent.",
      });
    }

    if (
      triggeringUser.status !== "active" ||
      triggeringUser.capital <= 0
    ) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Robot inactif (pas de capital ou compte en pause).",
      });
    }

    // 3. Charger les configurations + état
    const [robotConfig, distConfig, distState] = await Promise.all([
      getRobotConfig(),
      getDistributionConfig(),
      getDistributionState(),
    ]);

    // 4. Anti double-distribution
    const now = Date.now();
    const lastDistAt = new Date(distState.lastDistributionAt).getTime();
    if (now - lastDistAt < distConfig.minIntervalSec * 1000) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Distribution trop récente, réessayez plus tard.",
      });
    }

    // 5. Trouver TOUS les utilisateurs managed actifs avec capital > 0
    const whereClause: {
      mode: string;
      capital: { gt: number };
      status?: string;
    } = {
      mode: "managed",
      capital: { gt: 0 },
    };
    if (distConfig.excludePausedUsers) {
      whereClause.status = "active";
    }

    const managedUsers = await db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        balance: true,
        capital: true,
        totalGains: true,
        totalExchanges: true,
      },
    });

    // 6. Aucun utilisateur éligible
    if (managedUsers.length === 0) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Aucun utilisateur éligible à la distribution.",
      });
    }

    // 7. Calcul du capital total du pool
    const totalCapital = managedUsers.reduce(
      (sum, u) => sum + u.capital,
      0
    );
    if (totalCapital <= 0) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Capital total insuffisant.",
      });
    }

    // 8. Générer le bénéfice réel du trade (basé sur le capital TOTAL)
    const rate =
      robotConfig.dailyRateLow +
      Math.random() *
        (robotConfig.dailyRateHigh - robotConfig.dailyRateLow);
    const actualProfit = Math.round(
      (totalCapital * rate * robotConfig.demoMultiplier) /
        robotConfig.ticksPerDay
    );

    // Taux de réussite: parfois le robot ne fait rien
    if (Math.random() > robotConfig.successRate) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Aucune opportunité rentable pour le moment.",
      });
    }

    if (actualProfit <= 0) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Bénéfice réel insuffisant.",
      });
    }

    // 9. Appliquer le taux d'exposition
    const exposedProfit = Math.round(
      actualProfit * distConfig.exposureRate
    );
    const hiddenRetention = actualProfit - exposedProfit;

    // 10. Appliquer la commission
    const commission = Math.round(
      exposedProfit * distConfig.commissionRate
    );
    const distributable = exposedProfit - commission;

    if (distributable <= 0) {
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Montant distribuable insuffisant.",
      });
    }

    // 11. Distribuer à chaque utilisateur prorata son capital
    const updates: {
      userId: string;
      gain: number;
      newBalance: number;
      newTotalGains: number;
      newTotalExchanges: number;
      description: string;
    }[] = [];

    let totalDistributed = 0;
    for (const u of managedUsers) {
      const share = u.capital / totalCapital;
      const rawGain = distributable * share;
      const roundedGain = applyRounding(rawGain, distConfig.roundingMode);
      const gain = Math.max(distConfig.minGainPerUser, roundedGain);

      const newBalance = u.balance + gain;
      const newTotalGains = u.totalGains + gain;
      const newTotalExchanges = u.totalExchanges + 1;
      const description = `Échange automatique réussi — gain : ${formatXAF(gain)} XAF`;

      updates.push({
        userId: u.id,
        gain,
        newBalance,
        newTotalGains,
        newTotalExchanges,
        description,
      });
      totalDistributed += gain;
    }

    // 12. Choisir un marché au hasard pour la description du trade
    const market = MARKETS[Math.floor(Math.random() * MARKETS.length)];

    // Nouvel état de distribution (cumulatif)
    const newDistState: DistributionState = {
      lastDistributionAt: new Date(now).toISOString(),
      totalActualProfit: distState.totalActualProfit + actualProfit,
      totalExposedProfit: distState.totalExposedProfit + exposedProfit,
      totalCommission: distState.totalCommission + commission,
      totalHiddenRetention: distState.totalHiddenRetention + hiddenRetention,
      totalDistributedToUsers:
        distState.totalDistributedToUsers + totalDistributed,
      distributionCount: distState.distributionCount + 1,
      lastTradeActualProfit: actualProfit,
      lastTradeExposedProfit: exposedProfit,
      lastTradeUserCount: managedUsers.length,
      lastTradeTotalCapital: totalCapital,
    };

    // 13. Transaction atomique: tout réussit ou rien
    let triggeringTxCreatedAt: string | null = null;

    await db.$transaction(async (tx) => {
      for (const u of updates) {
        await tx.user.update({
          where: { id: u.userId },
          data: {
            balance: u.newBalance,
            totalGains: u.newTotalGains,
            totalExchanges: u.newTotalExchanges,
          },
        });
        const txRow = await tx.transaction.create({
          data: {
            userId: u.userId,
            type: "gain",
            amount: u.gain,
            balanceAfter: u.newBalance,
            description: u.description,
          },
        });
        await tx.robotEvent.create({
          data: {
            userId: u.userId,
            gain: u.gain,
            market: market.name,
            pair: market.pair,
          },
        });
        if (u.userId === userId) {
          triggeringTxCreatedAt = txRow.createdAt.toISOString();
        }
      }

      // Mettre à jour l'état de distribution (clé "distribution-state")
      await tx.config.upsert({
        where: { key: "distribution-state" },
        update: { value: JSON.stringify(newDistState) },
        create: {
          key: "distribution-state",
          value: JSON.stringify(newDistState),
        },
      });
    });

    // 14. Retourner le gain de l'utilisateur déclencheur
    const triggeringUpdate = updates.find((u) => u.userId === userId);
    if (!triggeringUpdate) {
      // Cas limite: l'utilisateur déclencheur n'était pas dans la liste
      // (race condition: capital devenu 0 ou compte suspendu entre-temps)
      return NextResponse.json({
        ok: true,
        acted: false,
        reason: "Utilisateur non éligible à cette distribution.",
      });
    }

    return NextResponse.json({
      ok: true,
      acted: true,
      gain: triggeringUpdate.gain,
      balance: triggeringUpdate.newBalance,
      totalGains: triggeringUpdate.newTotalGains,
      totalExchanges: triggeringUpdate.newTotalExchanges,
      market: market.name,
      pair: market.pair,
      description: triggeringUpdate.description,
      createdAt: triggeringTxCreatedAt,
    });
  } catch (err) {
    console.error("[robot/tick] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
