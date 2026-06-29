// CashPilot - Admin stats: métriques agrégées du tableau de bord admin
// GET /api/admin/stats?period=7d|30d|all (default 30d)
// Retourne un objet AdminStats (cf. src/lib/types.ts):
//  - totalUsers, managedUsers, alertsUsers
//  - activeSubscriptions, totalCapital, totalGains, totalExchanges
//  - mrr (somme des prix des abonnements actifs)
//  - totalDeposits, totalWithdrawals, totalSubscriptionRevenue
//  - usersGrowth (14 derniers jours), revenueByPlan, transactionsByType

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlansConfig, getDistributionState } from "@/lib/config-server";
import type { AdminStats } from "@/lib/types";

function periodToStart(period: string): Date | null {
  const now = Date.now();
  if (period === "7d") {
    return new Date(now - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === "30d") {
    return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
  // "all" ou invalide → pas de filtre date
  return null;
}

function dayKey(d: Date): string {
  // YYYY-MM-DD (UTC) — stable bucket key
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get("period") || "30d";
    const startDate = periodToStart(period);
    const now = new Date();

    // Récupère les prix des plans pour le calcul du MRR et de revenueByPlan.
    const plans = await getPlansConfig();
    const priceByPlanId = new Map<string, number>();
    const nameByPlanId = new Map<string, string>();
    for (const p of plans) {
      priceByPlanId.set(p.id, p.price);
      nameByPlanId.set(p.id, p.name);
    }

    // État de distribution (pour les métriques pool-based)
    const distState = await getDistributionState();

    // Filtre date pour les agrégations de transactions.
    const txDateFilter = startDate ? { gte: startDate } : undefined;

    // Lancer toutes les requêtes indépendantes en parallèle.
    const [
      totalUsersAgg,
      byMode,
      activeSubscriptionsCount,
      capitalAgg,
      gainsAgg,
      exchangesAgg,
      activeSubsByPlan,
      depositsAgg,
      withdrawalsAgg,
      subsRevenueAgg,
      transactionsByTypeGroup,
      recentUsers,
    ] = await Promise.all([
      // 1. Nombre total d'utilisateurs
      db.user.count(),

      // 2. Répartition par mode
      db.user.groupBy({
        by: ["mode"],
        _count: true,
      }),

      // 3. Abonnements actifs (expire dans le futur)
      db.user.count({
        where: {
          subscriptionExpiresAt: { gt: now },
        },
      }),

      // 4. Capital total
      db.user.aggregate({ _sum: { capital: true } }),

      // 5. Gains totaux cumulés
      db.user.aggregate({ _sum: { totalGains: true } }),

      // 6. Échanges totaux cumulés
      db.user.aggregate({ _sum: { totalExchanges: true } }),

      // 7. Abonnements actifs groupés par plan
      db.user.groupBy({
        by: ["subscriptionPlan"],
        _count: true,
        where: {
          subscriptionExpiresAt: { gt: now },
          subscriptionPlan: { not: null },
        },
      }),

      // 8. Total des dépôts (somme des montants positifs de type deposit)
      db.transaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          type: "deposit",
          ...(txDateFilter ? { createdAt: txDateFilter } : {}),
        },
      }),

      // 9. Total des retraits (les montants sont négatifs, on somme puis prend la valeur absolue)
      db.transaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          type: "withdraw",
          ...(txDateFilter ? { createdAt: txDateFilter } : {}),
        },
      }),

      // 10. Revenu total des abonnements
      db.transaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: {
          type: "subscription",
          ...(txDateFilter ? { createdAt: txDateFilter } : {}),
        },
      }),

      // 11. Transactions groupées par type (avec filtre période)
      db.transaction.groupBy({
        by: ["type"],
        _count: true,
        _sum: { amount: true },
        ...(txDateFilter ? { where: { createdAt: txDateFilter } } : {}),
      }),

      // 12. Utilisateurs créés dans les 14 derniers jours (pour usersGrowth)
      db.user.findMany({
        where: {
          createdAt: { gte: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) },
        },
        select: { createdAt: true },
      }),
    ]);

    // Répartition par mode
    let managedUsers = 0;
    let alertsUsers = 0;
    for (const g of byMode) {
      if (g.mode === "managed") managedUsers = g._count;
      else if (g.mode === "alerts") alertsUsers = g._count;
    }

    // MRR + revenueByPlan
    const revenueByPlan: { plan: string; count: number; revenue: number }[] = [];
    let mrr = 0;
    for (const g of activeSubsByPlan) {
      const planId = g.subscriptionPlan;
      if (!planId) continue;
      const count = g._count;
      const price = priceByPlanId.get(planId) ?? 0;
      const revenue = count * price;
      mrr += revenue;
      revenueByPlan.push({
        plan: nameByPlanId.get(planId) ?? planId,
        count,
        revenue,
      });
    }

    // Transactions par type (retraits négatifs → on prend |amount|)
    const transactionsByType: { type: string; count: number; amount: number }[] =
      transactionsByTypeGroup.map((g) => ({
        type: g.type,
        count: g._count,
        amount: Math.abs(g._sum.amount ?? 0),
      }));

    // Croissance utilisateurs (14 derniers jours) — bucket par jour
    const usersGrowth: { date: string; count: number }[] = [];
    const growthMap = new Map<string, number>();
    for (const u of recentUsers) {
      const key = dayKey(u.createdAt);
      growthMap.set(key, (growthMap.get(key) ?? 0) + 1);
    }
    // Construire la liste des 14 derniers jours (du plus ancien au plus récent)
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = dayKey(d);
      usersGrowth.push({
        date: key,
        count: growthMap.get(key) ?? 0,
      });
    }

    const stats: AdminStats = {
      totalUsers: totalUsersAgg,
      managedUsers,
      alertsUsers,
      activeSubscriptions: activeSubscriptionsCount,
      totalCapital: capitalAgg._sum.capital ?? 0,
      totalGains: gainsAgg._sum.totalGains ?? 0,
      totalExchanges: exchangesAgg._sum.totalExchanges ?? 0,
      mrr,
      totalDeposits: depositsAgg._sum.amount ?? 0,
      totalWithdrawals: Math.abs(withdrawalsAgg._sum.amount ?? 0),
      totalSubscriptionRevenue: subsRevenueAgg._sum.amount ?? 0,
      usersGrowth,
      revenueByPlan,
      transactionsByType,
      distribution: {
        totalActualProfit: distState.totalActualProfit,
        totalExposedProfit: distState.totalExposedProfit,
        totalCommission: distState.totalCommission,
        totalHiddenRetention: distState.totalHiddenRetention,
        totalDistributedToUsers: distState.totalDistributedToUsers,
        distributionCount: distState.distributionCount,
        lastTradeActualProfit: distState.lastTradeActualProfit,
        lastTradeUserCount: distState.lastTradeUserCount,
        lastTradeAt: distState.lastDistributionAt,
      },
    };

    return NextResponse.json({ ok: true, stats });
  } catch (err) {
    console.error("[admin/stats] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
