// CashPilot - Admin distribution stats: métriques de la distribution des gains
// GET /api/admin/distribution-stats
// Retourne l'état de distribution + la config + les métriques calculées.

import { NextResponse } from "next/server";
import {
  getDistributionConfig,
  getDistributionState,
} from "@/lib/config-server";

export async function GET() {
  try {
    const [state, config] = await Promise.all([
      getDistributionState(),
      getDistributionConfig(),
    ]);

    // Métriques dérivées
    const effectiveExposureRate =
      state.totalActualProfit > 0
        ? state.totalExposedProfit / state.totalActualProfit
        : 0;

    const effectiveCommissionRate =
      state.totalExposedProfit > 0
        ? state.totalCommission / state.totalExposedProfit
        : 0;

    const averageGainPerDistribution =
      state.distributionCount > 0
        ? state.totalDistributedToUsers / state.distributionCount
        : 0;

    // Revenu total de la plateforme = commission + rétention cachée
    const platformTotalRevenue =
      state.totalCommission + state.totalHiddenRetention;

    return NextResponse.json({
      ok: true,
      state,
      config,
      metrics: {
        effectiveExposureRate,
        effectiveCommissionRate,
        averageGainPerDistribution,
        platformTotalRevenue,
      },
    });
  } catch (err) {
    console.error("[admin/distribution-stats] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
