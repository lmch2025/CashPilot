// CashPilot - Auth: Inscription via numéro de téléphone + PIN
// POST /api/auth/register
// Body: { phone: string, pin: string, name?: string }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPin, normalizePhone, isValidCameroonPhone } from "@/lib/utils";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, pin, name } = body as { phone: string; pin: string; name?: string };

    if (!phone || !pin) {
      return NextResponse.json(
        { ok: false, error: "Numéro et PIN requis." },
        { status: 400 }
      );
    }

    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { ok: false, error: "Le PIN doit être 4 chiffres." },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    if (!isValidCameroonPhone(normalized)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Numéro invalide. Exemple: 6XXXXXXXX (MTN/Orange Cameroun).",
        },
        { status: 400 }
      );
    }

    // Vérifier si le compte existe déjà
    const existing = await db.user.findUnique({ where: { phone: normalized } });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "Ce numéro a déjà un compte. Connectez-vous." },
        { status: 409 }
      );
    }

    const pinHash = await hashPin(pin);
    const user = await db.user.create({
      data: {
        phone: normalized,
        pinHash,
        name: name?.trim() || null,
        level: "starter",
        balance: 0,
        capital: 0,
        totalGains: 0,
        totalExchanges: 0,
        status: "active",
      },
    });

    return NextResponse.json({
      ok: true,
      userId: user.id,
      phone: user.phone,
    });
  } catch (err) {
    console.error("[auth/register] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}
