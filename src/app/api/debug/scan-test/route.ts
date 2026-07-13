// CashPilot - Debug: test scanner without auth
// GET /api/debug/scan-test
// Retourne le résultat du scan + les erreurs détaillées

import { NextRequest, NextResponse } from "next/server";
import { scanMarkets } from "@/lib/scanner/detector";

export async function GET(req: NextRequest) {
  try {
    const result = await scanMarkets("manual");
    return NextResponse.json({
      ok: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[debug/scan-test] error:", err);
    return NextResponse.json({
      ok: false,
      error: err instanceof Error ? err.message : "Erreur inconnue",
      stack: err instanceof Error ? err.stack?.split("\n").slice(0, 10) : null,
    }, { status: 500 });
  }
}
