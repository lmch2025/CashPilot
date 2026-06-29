// CashPilot - Admin config: lecture + mise à jour des configurations
// GET /api/admin/config → { ok, configs: { robot, opportunities, global, plans, admin, distribution } }
// PUT /api/admin/config { robot?, opportunities?, global?, plans?, admin?, distribution? } → { ok, configs }

import { NextRequest, NextResponse } from "next/server";
import {
  getAllConfigs,
  setRobotConfig,
  setOpportunitiesConfig,
  setGlobalConfig,
  setPlansConfig,
  setAdminConfig,
  setDistributionConfig,
} from "@/lib/config-server";
import type {
  RobotConfig,
  OpportunitiesConfig,
  GlobalConfig,
  PlanConfig,
  AdminConfig,
  DistributionConfig,
} from "@/lib/config-defaults";

export async function GET() {
  try {
    const configs = await getAllConfigs();
    return NextResponse.json({ ok: true, configs });
  } catch (err) {
    console.error("[admin/config GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      robot,
      opportunities,
      global,
      plans,
      admin,
      distribution,
    } = body as {
      robot?: RobotConfig;
      opportunities?: OpportunitiesConfig;
      global?: GlobalConfig;
      plans?: PlanConfig[];
      admin?: AdminConfig;
      distribution?: DistributionConfig;
    };

    // Mettre à jour chaque section fournie (en parallèle).
    await Promise.all([
      robot ? setRobotConfig(robot) : Promise.resolve(),
      opportunities
        ? setOpportunitiesConfig(opportunities)
        : Promise.resolve(),
      global ? setGlobalConfig(global) : Promise.resolve(),
      plans ? setPlansConfig(plans) : Promise.resolve(),
      admin ? setAdminConfig(admin) : Promise.resolve(),
      distribution ? setDistributionConfig(distribution) : Promise.resolve(),
    ]);

    // Recharger toutes les configs pour renvoyer l'état final.
    const configs = await getAllConfigs();
    return NextResponse.json({ ok: true, configs });
  } catch (err) {
    console.error("[admin/config PUT] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}
