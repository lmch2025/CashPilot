// CashPilot - Admin auth: vérifie le code d'accès admin
// POST /api/admin/auth
// Body: { code: string }
// Réponse: { ok: true } si le code correspond à admin.accessCode, sinon 401.

import { NextRequest, NextResponse } from "next/server";
import { getAdminConfig } from "@/lib/config-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body as { code?: string };

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { ok: false, error: "Code d'accès requis." },
        { status: 400 }
      );
    }

    const adminConfig = await getAdminConfig();

    if (code.trim() === adminConfig.accessCode) {
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { ok: false, error: "Code d'accès incorrect." },
      { status: 401 }
    );
  } catch (err) {
    console.error("[admin/auth] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
