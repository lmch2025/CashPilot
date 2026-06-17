// CashPilot - Auth: Vérification de numéro (envoi code SMS simulé)
// POST /api/auth/login  → demande de code SMS
//   Body: { phone: string }
//   Réponse: { ok: true, isNew: boolean, demoCode: string }
// POST /api/auth/login avec { phone, pin } → connexion compte existant
//   Réponse: { ok: true, userId, phone }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  normalizePhone,
  isValidCameroonPhone,
  generateSmsCode,
  verifyPin,
} from "@/lib/utils";

// En mémoire: code temporaire par numéro (durée de vie 5 min)
const pendingCodes = new Map<string, { code: string; expires: number }>();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, pin } = body as { phone: string; pin?: string };

    if (!phone) {
      return NextResponse.json(
        { ok: false, error: "Numéro requis." },
        { status: 400 }
      );
    }

    const normalized = normalizePhone(phone);
    if (!isValidCameroonPhone(normalized)) {
      return NextResponse.json(
        { ok: false, error: "Numéro invalide. Exemple: 6XXXXXXXX." },
        { status: 400 }
      );
    }

    // Si pin fourni: connexion compte existant
    if (pin) {
      const user = await db.user.findUnique({ where: { phone: normalized } });
      if (!user) {
        return NextResponse.json(
          { ok: false, error: "Aucun compte pour ce numéro. Créez un compte." },
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
      return NextResponse.json({
        ok: true,
        userId: user.id,
        phone: user.phone,
      });
    }

    // Sinon: envoyer un code SMS
    const user = await db.user.findUnique({ where: { phone: normalized } });
    const isNew = !user;

    const code = generateSmsCode();
    pendingCodes.set(normalized, {
      code,
      expires: Date.now() + 5 * 60 * 1000,
    });

    return NextResponse.json({
      ok: true,
      isNew,
      demoCode: code,
    });
  } catch (err) {
    console.error("[auth/login] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}

// GET: vérifier un code (utilisé par le flow onboarding)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { phone, code } = body as { phone: string; code: string };

    const normalized = normalizePhone(phone);
    const entry = pendingCodes.get(normalized);

    if (!entry || entry.expires < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "Code expiré. Demandez un nouveau code." },
        { status: 400 }
      );
    }

    if (entry.code !== code) {
      return NextResponse.json(
        { ok: false, error: "Code incorrect. Vérifiez le code." },
        { status: 400 }
      );
    }

    pendingCodes.delete(normalized);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/login verify] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
