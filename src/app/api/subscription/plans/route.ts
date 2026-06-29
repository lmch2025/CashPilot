// CashPilot - Plans d'abonnement (mode alerts)
// GET /api/subscription/plans
// Retourne la liste des plans d'abonnement actifs (depuis la configuration admin).

import { NextResponse } from "next/server";
import { getPlansConfig } from "@/lib/config-server";

export async function GET() {
  try {
    const allPlans = await getPlansConfig();
    // Ne renvoyer que les plans actifs (admin peut désactiver un plan via la config)
    const activePlans = allPlans.filter((p) => p.active);

    return NextResponse.json({
      ok: true,
      plans: activePlans,
    });
  } catch (err) {
    console.error("[subscription/plans] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
