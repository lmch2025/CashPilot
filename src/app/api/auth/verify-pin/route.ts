// CashPilot - Auth: Vérification du PIN pour actions sensibles (retrait)
// POST /api/auth/verify-pin
// Body: { userId: string, pin: string }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPin } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, pin } = body as { userId: string; pin: string };

    if (!userId || !pin) {
      return NextResponse.json(
        { ok: false, error: "Identifiant et PIN requis." },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Compte introuvable." },
        { status: 404 }
      );
    }

    const valid = await verifyPin(pin, user.pinHash);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "PIN incorrect. Réessayez." },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/verify-pin] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
