// CashPilot - Debug: list detected opportunities without auth
// GET /api/debug/opportunities
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const opportunities = await db.detectedOpportunity.findMany({
      orderBy: { detectedAt: "desc" },
      take: 20,
    });

    const scanLogs = await db.scanLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      ok: true,
      opportunitiesCount: opportunities.length,
      opportunities: opportunities.map((o) => ({
        id: o.id,
        type: o.type,
        approvalStatus: o.approvalStatus,
        pair: o.pair,
        spreadPercent: o.spreadPercent,
        buyPlatform: o.buyPlatform,
        sellPlatform: o.sellPlatform,
        buyPrice: o.buyPrice,
        sellPrice: o.sellPrice,
        detectedAt: o.detectedAt,
        description: o.description.substring(0, 120),
      })),
      scanLogs: scanLogs.map((l) => ({
        id: l.id,
        trigger: l.trigger,
        status: l.status,
        opportunitiesFound: l.opportunitiesFound,
        duration: l.duration,
        error: l.error,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    console.error("[debug/opportunities] error:", err);
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
    }, { status: 500 });
  }
}
