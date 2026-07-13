// CashPilot - Admin: scan logs (monitoring)
// GET /api/admin/scanner/logs?page=1&limit=20
//
// Retourne les ScanLog paginés, du plus récent au plus ancien.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );
    const status = params.get("status") ?? undefined;

    const where: Record<string, string> = {};
    if (status && ["success", "error", "partial"].includes(status)) {
      where.status = status;
    }

    const [total, rows] = await Promise.all([
      db.scanLog.count({ where }),
      db.scanLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      ok: true,
      logs: rows.map((l) => ({
        id: l.id,
        trigger: l.trigger,
        status: l.status,
        platformsScanned: safeParseArray(l.platformsScanned),
        opportunitiesFound: l.opportunitiesFound,
        opportunitiesApproved: l.opportunitiesApproved,
        duration: l.duration,
        error: l.error,
        createdAt: l.createdAt.toISOString(),
      })),
      total,
      page,
      totalPages,
    });
  } catch (err) {
    console.error("[admin/scanner/logs GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}

function safeParseArray(s: string): string[] {
  try {
    const arr = JSON.parse(s);
    if (Array.isArray(arr)) return arr as string[];
  } catch {
    // ignore
  }
  return [];
}
