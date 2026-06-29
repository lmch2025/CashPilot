// CashPilot - Changement de mode (managed <-> alerts)
// POST /api/user/mode
// Body: { userId: string, mode: "managed" | "alerts" }
// Bascule simplement le mode de fonctionnement de l'utilisateur.
// Passer en "alerts" sans abonnement actif est autorisé : l'UI invitera à s'abonner.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { UserMode } from "@/lib/types";

const VALID_MODES: UserMode[] = ["managed", "alerts"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, mode } = body as { userId: string; mode: string };

    if (!userId || !mode) {
      return NextResponse.json(
        { ok: false, error: "Informations manquantes." },
        { status: 400 }
      );
    }

    if (!VALID_MODES.includes(mode as UserMode)) {
      return NextResponse.json(
        { ok: false, error: "Mode invalide." },
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

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { mode: mode as UserMode },
    });

    return NextResponse.json({
      ok: true,
      mode: updatedUser.mode,
    });
  } catch (err) {
    console.error("[user/mode] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
