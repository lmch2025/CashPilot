// CashPilot - Admin users: liste paginée des utilisateurs
// GET /api/admin/users?page=1&limit=20&search=phone&mode=managed|alerts&status=active&sort=createdAt&order=desc
// Réponse: { ok, users: AdminUser[], total, page, limit, totalPages }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

const ALLOWED_SORTS = new Set([
  "createdAt",
  "balance",
  "totalGains",
  "totalExchanges",
]);

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(sp.get("limit") || "20", 10)));
    const search = sp.get("search")?.trim() || "";
    const mode = sp.get("mode") || ""; // "managed" | "alerts" | ""
    const status = sp.get("status") || ""; // "active" | "paused" | ""
    const sortRaw = sp.get("sort") || "createdAt";
    const sort = ALLOWED_SORTS.has(sortRaw) ? sortRaw : "createdAt";
    const order = sp.get("order") === "asc" ? "asc" : "desc";

    const where: Prisma.UserWhereInput = {};
    if (search) {
      where.phone = { contains: search };
    }
    if (mode === "managed" || mode === "alerts") {
      where.mode = mode;
    }
    if (status === "active" || status === "paused") {
      where.status = status;
    }

    const [total, users] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        orderBy: { [sort]: order },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({
        id: u.id,
        phone: u.phone,
        name: u.name,
        level: u.level,
        balance: u.balance,
        capital: u.capital,
        totalGains: u.totalGains,
        totalExchanges: u.totalExchanges,
        status: u.status,
        mode: u.mode,
        subscriptionPlan: u.subscriptionPlan,
        subscriptionExpiresAt: u.subscriptionExpiresAt
          ? u.subscriptionExpiresAt.toISOString()
          : null,
        createdAt: u.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages,
    });
  } catch (err) {
    console.error("[admin/users] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
