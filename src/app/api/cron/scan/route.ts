// CashPilot - Cron webhook endpoint (cron-job.org)
// GET/POST /api/cron/scan?key=SECRET_KEY
//
// Vercel hobby n'inclut pas de cron natif: on s'appuie sur cron-job.org
// qui appelle cette URL à intervalle régulier. L'authentification se fait
// via une clé secrète partagée (config.cronJobOrgKey).
//
// Flow:
//   1. Vérifier que ?key=... correspond à config.cronJobOrgKey (sinon 401).
//   2. Appeler scanMarkets("cron").
//   3. Retourner rapidement { ok: true, result } (Vercel = 10s timeout).

import { NextRequest, NextResponse } from "next/server";
import { scanMarkets } from "@/lib/scanner/detector";
import { getAutomationConfig } from "@/lib/config-server";

async function handleScan(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth: vérifier la clé partagée
    const key = req.nextUrl.searchParams.get("key");
    const config = await getAutomationConfig();

    if (!key || key !== config.cronJobOrgKey) {
      return NextResponse.json(
        { ok: false, error: "Clé d'authentification invalide." },
        { status: 401 }
      );
    }

    // 2. Lancer le scan (trigger=cron)
    const result = await scanMarkets("cron");

    // 3. Réponse rapide
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[cron/scan] error:", err);
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

// cron-job.org peut utiliser GET ou POST — on supporte les deux.
export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleScan(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleScan(req);
}
