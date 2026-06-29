// CashPilot - Abonnement via Mobile Money (mode alerts)
// POST /api/subscription/subscribe
// Body: { userId: string, planId: "decouverte" | "standard" | "premium", operator: "mtn" | "orange" }
// - Valide l'utilisateur, le plan (depuis la config admin, plan doit être actif) et l'opérateur.
// - Crée une Transaction type="subscription" (n'affecte PAS le solde/capital).
// - Active le mode "alerts" et l'abonnement pour 30 jours.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatXAF } from "@/lib/utils";
import { getPlansConfig } from "@/lib/config-server";
import type { SubscriptionPlanId, MobileOperator } from "@/lib/types";

const SUBSCRIPTION_DURATION_DAYS = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, planId, operator } = body as {
      userId: string;
      planId: string;
      operator: string;
    };

    if (!userId || !planId || !operator) {
      return NextResponse.json(
        { ok: false, error: "Informations manquantes." },
        { status: 400 }
      );
    }

    // Valider l'opérateur
    if (operator !== "mtn" && operator !== "orange") {
      return NextResponse.json(
        { ok: false, error: "Opérateur Mobile Money invalide." },
        { status: 400 }
      );
    }

    // Charger les plans depuis la config admin et valider le plan choisi:
    // il doit exister ET être actif.
    const plans = await getPlansConfig();
    const plan = plans.find((p) => p.id === planId);
    if (!plan || !plan.active) {
      return NextResponse.json(
        { ok: false, error: "Plan d'abonnement invalide ou indisponible." },
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
    const expiresAt = new Date(
      now.getTime() + SUBSCRIPTION_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    const operatorLabel = operator === "mtn" ? "MTN Money" : "Orange Money";

    // L'abonnement est un frais séparé du capital de trading.
    // On ne touche PAS à balance/capital — on enregistre juste la transaction.
    // Le prix provient de la config admin (plan.price).
    const [updatedUser, transaction] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: {
          mode: "alerts",
          subscriptionPlan: planId,
          subscriptionExpiresAt: expiresAt,
        },
      }),
      db.transaction.create({
        data: {
          userId,
          type: "subscription",
          amount: plan.price,
          balanceAfter: user.balance, // inchangé
          description: `Abonnement ${plan.name} — ${formatXAF(plan.price)} XAF/mois via ${operatorLabel}`,
          operator: operator as MobileOperator,
          planId: planId as SubscriptionPlanId,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      mode: updatedUser.mode,
      subscriptionPlan: updatedUser.subscriptionPlan,
      subscriptionExpiresAt: updatedUser.subscriptionExpiresAt?.toISOString() || null,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        operator: transaction.operator,
        planId: transaction.planId,
        createdAt: transaction.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[subscription/subscribe] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}
