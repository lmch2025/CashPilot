// CashPilot - Admin: liste des opportunités détectées
// GET /api/admin/scanner/opportunities?status=pending&level=full_auto&type=p2p_arbitrage&page=1&limit=20
//
// Retourne les DetectedOpportunity paginées + filtrées.
// Filtres disponibles (tous optionnels):
//   - status: "pending" | "approved" | "rejected" | "expired"
//   - level:  "full_auto" | "semi_auto" | "manual"
//   - type:   "p2p_arbitrage" | "inter_platform" | "triangular" | "funding_rate" | ...
//   - risk:   "low" | "medium" | "high"

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const VALID_STATUSES = new Set([
  "pending",
  "approved",
  "rejected",
  "expired",
]);
const VALID_LEVELS = new Set(["full_auto", "semi_auto", "manual"]);
const VALID_RISKS = new Set(["low", "medium", "high"]);

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params = req.nextUrl.searchParams;
    const status = params.get("status") ?? undefined;
    const level = params.get("level") ?? undefined;
    const type = params.get("type") ?? undefined;
    const risk = params.get("risk") ?? undefined;
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    // Build where clause
    const where: Record<string, string> = {};
    if (status && VALID_STATUSES.has(status)) where.approvalStatus = status;
    if (level && VALID_LEVELS.has(level)) where.automationLevel = level;
    if (type) where.type = type;
    if (risk && VALID_RISKS.has(risk)) where.riskLevel = risk;

    const [total, rows] = await Promise.all([
      db.detectedOpportunity.count({ where }),
      db.detectedOpportunity.findMany({
        where,
        orderBy: { detectedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      ok: true,
      opportunities: rows.map((o) => ({
        id: o.id,
        type: o.type,
        automationLevel: o.automationLevel,
        buyPlatform: o.buyPlatform,
        sellPlatform: o.sellPlatform,
        pair: o.pair,
        buyPrice: o.buyPrice,
        sellPrice: o.sellPrice,
        spreadPercent: o.spreadPercent,
        estimatedGain: o.estimatedGain,
        estimatedGainPercent: o.estimatedGainPercent,
        capitalRequired: o.capitalRequired,
        approvalStatus: o.approvalStatus,
        dryRun: o.dryRun,
        validUntil: o.validUntil.toISOString(),
        riskLevel: o.riskLevel,
        description: o.description,
        detectedAt: o.detectedAt.toISOString(),
        approvedAt: o.approvedAt ? o.approvedAt.toISOString() : null,
        approvedBy: o.approvedBy,
        expiresAt: o.expiresAt ? o.expiresAt.toISOString() : null,
      })),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    console.error("[admin/scanner/opportunities GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
