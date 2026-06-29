// CashPilot - Retrait vers Mobile Money
// POST /api/withdraw
// Body: { userId: string, amount: number, operator: "mtn" | "orange", pin: string, mode: "gains" | "all" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatXAF, verifyPin } from "@/lib/utils";
import { getGlobalConfig } from "@/lib/config-server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, operator, pin } = body as {
      userId: string;
      amount: number;
      operator: "mtn" | "orange";
      pin: string;
    };

    if (!userId || !amount || !operator || !pin) {
      return NextResponse.json(
        { ok: false, error: "Informations manquantes." },
        { status: 400 }
      );
    }

    const { minWithdraw } = await getGlobalConfig();

    if (amount < minWithdraw) {
      return NextResponse.json(
        {
          ok: false,
          error: `Le retrait minimum est de ${formatXAF(minWithdraw)} XAF.`,
        },
        { status: 400 }
      );
    }

    if (operator !== "mtn" && operator !== "orange") {
      return NextResponse.json(
        { ok: false, error: "Opérateur invalide." },
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

    // Vérifier le PIN
    const validPin = verifyPin(pin, user.pinHash);
    if (!validPin) {
      return NextResponse.json(
        { ok: false, error: "PIN incorrect. Réessayez." },
        { status: 401 }
      );
    }

    if (amount > user.balance) {
      return NextResponse.json(
        {
          ok: false,
          error: `Solde insuffisant. Votre solde est de ${formatXAF(user.balance)} XAF.`,
        },
        { status: 400 }
      );
    }

    const newBalance = user.balance - amount;

    const transaction = await db.transaction.create({
      data: {
        userId,
        type: "withdraw",
        amount: -amount,
        balanceAfter: newBalance,
        description: `Retrait ${operator === "mtn" ? "MTN Money" : "Orange Money"} de ${formatXAF(amount)} XAF`,
        operator,
      },
    });

    await db.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });

    return NextResponse.json({
      ok: true,
      balance: newBalance,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        operator: transaction.operator,
        createdAt: transaction.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[withdraw] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}
