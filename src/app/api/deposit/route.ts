// CashPilot - Dépôt via Mobile Money
// POST /api/deposit
// Body: { userId: string, amount: number, operator: "mtn" | "orange" }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatXAF } from "@/lib/utils";

const MIN_DEPOSIT = 10000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, amount, operator } = body as {
      userId: string;
      amount: number;
      operator: "mtn" | "orange";
    };

    if (!userId || !amount || !operator) {
      return NextResponse.json(
        { ok: false, error: "Informations manquantes." },
        { status: 400 }
      );
    }

    if (amount < MIN_DEPOSIT) {
      return NextResponse.json(
        {
          ok: false,
          error: `Le dépôt minimum est de ${formatXAF(MIN_DEPOSIT)} XAF.`,
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

    // Effectuer le dépôt
    const newBalance = user.balance + amount;
    const newCapital = user.capital + amount;

    const [updatedUser, transaction] = await db.$transaction([
      db.user.update({
        where: { id: userId },
        data: { balance: newBalance, capital: newCapital },
      }),
      db.transaction.create({
        data: {
          userId,
          type: "deposit",
          amount,
          balanceAfter: newBalance,
          description: `Dépôt ${operator === "mtn" ? "MTN Money" : "Orange Money"} de ${formatXAF(amount)} XAF`,
          operator,
        },
      }),
    ]);

    // Si l'utilisateur passe le seuil Croissance (50 000 XAF), on notifie via la réponse
    const becameCroissance = user.level === "starter" && newCapital >= 50000;
    if (becameCroissance) {
      await db.user.update({
        where: { id: userId },
        data: { level: "croissance" },
      });
    }

    return NextResponse.json({
      ok: true,
      balance: newBalance,
      capital: newCapital,
      transaction: {
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        balanceAfter: transaction.balanceAfter,
        description: transaction.description,
        operator: transaction.operator,
        createdAt: transaction.createdAt.toISOString(),
      },
      becameCroissance,
    });
  } catch (err) {
    console.error("[deposit] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur. Réessayez." },
      { status: 500 }
    );
  }
}
