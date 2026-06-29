// CashPilot - Action sur une opportunité (mode alerts)
// POST /api/opportunities/action
// Body: { userId: string, opportunityId: string, action: "executed" | "skipped" }
// Marque une opportunité comme exécutée ou ignorée par l'utilisateur.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { OpportunityStatus } from "@/lib/types";

const VALID_ACTIONS: OpportunityStatus[] = ["executed", "skipped"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, opportunityId, action } = body as {
      userId: string;
      opportunityId: string;
      action: string;
    };

    if (!userId || !opportunityId || !action) {
      return NextResponse.json(
        { ok: false, error: "Informations manquantes." },
        { status: 400 }
      );
    }

    if (!VALID_ACTIONS.includes(action as OpportunityStatus)) {
      return NextResponse.json(
        { ok: false, error: "Action invalide." },
        { status: 400 }
      );
    }

    const opportunity = await db.opportunity.findUnique({
      where: { id: opportunityId },
    });

    if (!opportunity) {
      return NextResponse.json(
        { ok: false, error: "Opportunité introuvable." },
        { status: 404 }
      );
    }

    if (opportunity.userId !== userId) {
      return NextResponse.json(
        { ok: false, error: "Cette opportunité ne vous appartient pas." },
        { status: 403 }
      );
    }

    if (opportunity.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Cette opportunité n'est plus disponible." },
        { status: 400 }
      );
    }

    const updated = await db.opportunity.update({
      where: { id: opportunityId },
      data: { status: action as OpportunityStatus },
    });

    return NextResponse.json({
      ok: true,
      opportunity: {
        id: updated.id,
        market: updated.market,
        pair: updated.pair,
        buyPrice: updated.buyPrice,
        sellPrice: updated.sellPrice,
        estimatedGain: updated.estimatedGain,
        estimatedGainPercent: updated.estimatedGainPercent,
        validUntil: updated.validUntil.toISOString(),
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[opportunities/action] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
