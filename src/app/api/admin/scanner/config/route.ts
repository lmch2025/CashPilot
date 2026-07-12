// CashPilot - Admin: Automation config GET/PUT
// GET  /api/admin/scanner/config → { ok, config: AutomationConfig }
// PUT  /api/admin/scanner/config { config: AutomationConfig } → { ok, config }
//
// Lecture / écriture de la configuration du scanner (dry-run, plateformes,
// types d'arbitrage, seuils, auto-approbation, API keys, cron-job.org).

import { NextRequest, NextResponse } from "next/server";
import {
  getAutomationConfig,
  setAutomationConfig,
} from "@/lib/config-server";
import { DEFAULT_AUTOMATION_CONFIG, type AutomationConfig } from "@/lib/config-defaults";

export async function GET(): Promise<NextResponse> {
  try {
    const config = await getAutomationConfig();
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    console.error("[admin/scanner/config GET] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const incoming = body?.config as Partial<AutomationConfig> | undefined;

    if (!incoming || typeof incoming !== "object") {
      return NextResponse.json(
        { ok: false, error: "Corps de requête invalide: 'config' manquant." },
        { status: 400 }
      );
    }

    // Start from the current saved config (so partial updates work safely)
    const current = await getAutomationConfig();

    // Merge top-level scalars
    const merged: AutomationConfig = {
      ...DEFAULT_AUTOMATION_CONFIG,
      ...current,
      ...incoming,
      // Deep-merge nested objects so callers can update sub-fields
      platforms: {
        ...current.platforms,
        ...(incoming.platforms ?? {}),
      },
      arbitrageTypes: {
        ...current.arbitrageTypes,
        ...(incoming.arbitrageTypes ?? {}),
      },
    };

    // Validate types / coerce
    merged.dryRun = Boolean(merged.dryRun);
    merged.scannerEnabled = Boolean(merged.scannerEnabled);
    merged.scanIntervalMin = clampPositiveInt(merged.scanIntervalMin, 5);
    merged.minSpreadPercent = clampPositiveNumber(merged.minSpreadPercent, 0.5);
    merged.minEstimatedGain = clampPositiveNumber(merged.minEstimatedGain, 500);
    merged.capitalReference = clampPositiveNumber(merged.capitalReference, 50000);
    merged.autoApproveLowRisk = Boolean(merged.autoApproveLowRisk);
    merged.autoApproveSpreadMin = clampPositiveNumber(merged.autoApproveSpreadMin, 3);
    merged.useScraperForGeoblocked = Boolean(merged.useScraperForGeoblocked);
    if (!["low", "medium", "high"].includes(merged.maxRiskLevel)) {
      merged.maxRiskLevel = "medium";
    }

    await setAutomationConfig(merged);

    return NextResponse.json({ ok: true, config: merged });
  } catch (err) {
    console.error("[admin/scanner/config PUT] error:", err);
    return NextResponse.json(
      { ok: false, error: "Erreur serveur." },
      { status: 500 }
    );
  }
}

function clampPositiveNumber(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function clampPositiveInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}
