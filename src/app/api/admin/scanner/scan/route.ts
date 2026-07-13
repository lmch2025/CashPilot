// CashPilot - Admin manual scan trigger
// POST /api/admin/scanner/scan
// Body (optionnel): { trigger?: "manual" | "admin" }
//
// Déclenche un scan manuel depuis l'interface admin (bouton "Scanner maintenant").
// Contrairement à /api/cron/scan, pas d'auth par clé (l'admin est déjà authentifié).

import { NextRequest, NextResponse } from "next/server";
import { scanMarkets } from "@/lib/scanner/detector";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    let trigger: "manual" | "admin" = "manual";
    try {
      const body = await req.json();
      if (body?.trigger === "admin" || body?.trigger === "manual") {
        trigger = body.trigger;
      }
    } catch {
      // Body vide ou JSON invalide → on garde "manual" par défaut.
    }

    const result = await scanMarkets(trigger);

    return NextResponse.json({
      ok: true,
      ...result,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/scanner/scan] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Erreur lors du scan.",
        detail: (err as Error)?.message ?? "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
