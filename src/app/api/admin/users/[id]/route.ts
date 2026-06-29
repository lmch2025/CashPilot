// CashPilot - Admin user detail: détail + édition
// GET /api/admin/users/:id → { ok, user, recentTransactions }
// PATCH /api/admin/users/:id { status?, mode?, level? } → { ok, user }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Utilisateur introuvable." },
        { status: 404 }
      );
    }

    const recentTransactions = await db.transaction.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        level: user.level,
        balance: user.balance,
        capital: user.capital,
        totalGains: user.totalGains,
        totalExchanges: user.totalExchanges,
        status: user.status,
        mode: user.mode,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiresAt: user.subscriptionExpiresAt
          ? user.subscriptionExpiresAt.toISOString()
          : null,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      recentTransactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        operator: t.operator,
        planId: t.planId,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[admin/users/:id GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, mode, level } = body as {
      status?: string;
      mode?: string;
      level?: string;
    };

    const data: Record<string, string> = {};

    if (status !== undefined) {
      if (status !== "active" && status !== "paused") {
        return NextResponse.json(
          { ok: false, error: "Statut invalide." },
          { status: 400 }
        );
      }
      data.status = status;
    }

    if (mode !== undefined) {
      if (mode !== "managed" && mode !== "alerts") {
        return NextResponse.json(
          { ok: false, error: "Mode invalide." },
          { status: 400 }
        );
      }
      data.mode = mode;
    }

    if (level !== undefined) {
      if (level !== "starter" && level !== "croissance") {
        return NextResponse.json(
          { ok: false, error: "Niveau invalide." },
          { status: 400 }
        );
      }
      data.level = level;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { ok: false, error: "Aucun champ à mettre à jour." },
        { status: 400 }
      );
    }

    const updated = await db.user.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: updated.id,
        phone: updated.phone,
        name: updated.name,
        level: updated.level,
        balance: updated.balance,
        capital: updated.capital,
        totalGains: updated.totalGains,
        totalExchanges: updated.totalExchanges,
        status: updated.status,
        mode: updated.mode,
        subscriptionPlan: updated.subscriptionPlan,
        subscriptionExpiresAt: updated.subscriptionExpiresAt
          ? updated.subscriptionExpiresAt.toISOString()
          : null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[admin/users/:id PATCH] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
