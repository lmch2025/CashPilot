// CashPilot - Statut de l'abonnement (mode alerts)
// GET /api/subscription/status?userId=xxx
// Retourne l'état de l'abonnement de l'utilisateur.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getPlanById } from "@/lib/plans";

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

    const now = new Date();
    const expiresAt = user.subscriptionExpiresAt;
    const isActive = !!expiresAt && expiresAt.getTime() > now.getTime();

    let daysRemaining = 0;
    if (expiresAt) {
      const diffMs = expiresAt.getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    const plan = getPlanById(user.subscriptionPlan);

    return NextResponse.json({
      ok: true,
      mode: user.mode,
      plan,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
      isActive,
      daysRemaining,
    });
  } catch (err) {
    console.error("[subscription/status] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
