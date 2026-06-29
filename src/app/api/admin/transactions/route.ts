// CashPilot - Admin transactions: liste paginée des transactions (tous users)
// GET /api/admin/transactions?page=1&limit=50&type=deposit&startDate=ISO&endDate=ISO&search=phone
// Réponse: { ok, transactions: AdminTransaction[], total, page, limit, totalPages }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const VALID_TYPES = new Set([
  "deposit",
  "withdraw",
  "gain",
  "subscription",
]);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(
      500,
      Math.max(1, parseInt(sp.get("limit") || "50", 10))
    );
    const type = sp.get("type") || "";
    const startDate = sp.get("startDate") || "";
    const endDate = sp.get("endDate") || "";
    const search = sp.get("search")?.trim() || "";

    const where: Prisma.TransactionWhereInput = {};

    if (type && VALID_TYPES.has(type)) {
      where.type = type;
    }

    if (startDate || endDate) {
      const created: { gte?: Date; lte?: Date } = {};
      if (startDate) {
        const d = new Date(startDate);
        if (!isNaN(d.getTime())) created.gte = d;
      }
      if (endDate) {
        const d = new Date(endDate);
        if (!isNaN(d.getTime())) created.lte = d;
      }
      if (created.gte || created.lte) {
        where.createdAt = created;
      }
    }

    if (search) {
      where.user = { phone: { contains: search } };
    }

    const [total, transactions] = await Promise.all([
      db.transaction.count({ where }),
      db.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: { phone: true, name: true },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      ok: true,
      transactions: transactions.map((t) => ({
        id: t.id,
        userId: t.userId,
        userPhone: t.user.phone,
        userName: t.user.name,
        type: t.type,
        amount: t.amount,
        balanceAfter: t.balanceAfter,
        description: t.description,
        operator: t.operator,
        planId: t.planId,
        createdAt: t.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("[admin/transactions] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
