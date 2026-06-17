// CashPilot - Transactions (historique filtré)
// GET /api/transactions?userId=xxx&period=today|week|month|all&type=all|deposit|withdraw|gain

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isToday, isThisWeek, isThisMonth } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    const period = req.nextUrl.searchParams.get("period") || "all";
    const type = req.nextUrl.searchParams.get("type") || "all";

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Identifiant requis." },
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

    const where: { userId: string; type?: string } = { userId };
    if (type !== "all") {
      where.type = type;
    }

    const allTx = await db.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    let filtered = allTx;
    if (period === "today") {
      filtered = allTx.filter((t) => isToday(t.createdAt.toISOString()));
    } else if (period === "week") {
      filtered = allTx.filter((t) => isThisWeek(t.createdAt.toISOString()));
    } else if (period === "month") {
      filtered = allTx.filter((t) => isThisMonth(t.createdAt.toISOString()));
    }

    return NextResponse.json({
      ok: true,
      transactions: filtered.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        operator: t.operator,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[transactions] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
