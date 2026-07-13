// CashPilot - Admin: latest market data (live prices dashboard)
// GET /api/admin/scanner/market-data?platform=binance&pair=BTC/USDT&limit=50
//
// Retourne les N dernières lignes de MarketData, filtrables par plateforme et paire.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const params = req.nextUrl.searchParams;
    const platform = params.get("platform") ?? undefined;
    const pair = params.get("pair") ?? undefined;
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, parseInt(params.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT)
    );

    const where: Record<string, string> = {};
    if (platform) where.platform = platform;
    if (pair) where.pair = pair;

    const rows = await db.marketData.findMany({
      where,
      orderBy: { fetchedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        platform: r.platform,
        pair: r.pair,
        price: r.price,
        bid: r.bid,
        ask: r.ask,
        volume24h: r.volume24h,
        rawData: r.rawData,
        fetchedAt: r.fetchedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[admin/scanner/market-data GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
