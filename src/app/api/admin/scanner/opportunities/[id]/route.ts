// CashPilot - Admin: approve / reject a DetectedOpportunity
// PATCH /api/admin/scanner/opportunities/[id]
// Body: { action: "approve" | "reject" }
//
// Approve flow:
//   1. Update DetectedOpportunity: approvalStatus="approved", approvedAt, approvedBy="admin".
//   2. Distribute to ALL alerts-mode users with active subscription:
//      create one Opportunity per user (using the real detected data).
//
// Reject flow:
//   1. Update DetectedOpportunity: approvalStatus="rejected", approvedAt, approvedBy="admin".

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { distributeToAlertsUsers, type DetectedRaw } from "@/lib/scanner/detector";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { ok: false, error: "Action invalide. Utiliser 'approve' ou 'reject'." },
        { status: 400 }
      );
    }

    const opp = await db.detectedOpportunity.findUnique({ where: { id } });
    if (!opp) {
      return NextResponse.json(
        { ok: false, error: "Opportunité introuvable." },
        { status: 404 }
      );
    }

    if (opp.approvalStatus !== "pending") {
      return NextResponse.json(
        {
          ok: false,
          error: `Opportunité déjà traitée (statut: ${opp.approvalStatus}).`,
        },
        { status: 400 }
      );
    }

    const now = new Date();
    const newStatus = action === "approve" ? "approved" : "rejected";

    const updated = await db.detectedOpportunity.update({
      where: { id },
      data: {
        approvalStatus: newStatus,
        approvedAt: now,
        approvedBy: "admin",
      },
    });

    let distributedCount = 0;
    if (action === "approve") {
      const raw: DetectedRaw = {
        type: updated.type as DetectedRaw["type"],
        buyPlatform: updated.buyPlatform,
        sellPlatform: updated.sellPlatform,
        pair: updated.pair,
        buyPrice: updated.buyPrice,
        sellPrice: updated.sellPrice,
        spreadPercent: updated.spreadPercent,
        estimatedGain: updated.estimatedGain,
        estimatedGainPercent: updated.estimatedGainPercent,
        capitalRequired: updated.capitalRequired,
        riskLevel: updated.riskLevel as DetectedRaw["riskLevel"],
        automationLevel: updated.automationLevel as DetectedRaw["automationLevel"],
        description: updated.description,
      };
      try {
        distributedCount = await distributeToAlertsUsers(raw, updated.validUntil);
      } catch (e) {
        console.error("[admin/scanner/opportunities/:id] distribute error:", e);
        // On ne fait pas échouer la route, mais on signale le problème.
      }
    }

    return NextResponse.json({
      ok: true,
      opportunity: {
        id: updated.id,
        approvalStatus: updated.approvalStatus,
        approvedAt: updated.approvedAt ? updated.approvedAt.toISOString() : null,
        approvedBy: updated.approvedBy,
      },
      distributedToUsers: distributedCount,
    });
  } catch (err) {
    console.error("[admin/scanner/opportunities/:id PATCH] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}

// GET single opportunity (for detail view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const opp = await db.detectedOpportunity.findUnique({ where: { id } });
    if (!opp) {
      return NextResponse.json(
        { ok: false, error: "Opportunité introuvable." },
        { status: 404 }
      );
    }
    return NextResponse.json({
      ok: true,
      opportunity: {
        ...opp,
        validUntil: opp.validUntil.toISOString(),
        detectedAt: opp.detectedAt.toISOString(),
        approvedAt: opp.approvedAt ? opp.approvedAt.toISOString() : null,
        expiresAt: opp.expiresAt ? opp.expiresAt.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("[admin/scanner/opportunities/:id GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
