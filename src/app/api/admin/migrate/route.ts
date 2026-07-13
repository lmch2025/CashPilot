// CashPilot - Migration automatique des nouvelles tables
// GET /api/admin/migrate?code=ADMIN_CODE
// Crée les tables manquantes (MarketData, DetectedOpportunity, ScanLog) sur Neon

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminConfig } from "@/lib/config-server";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const adminConfig = await getAdminConfig();

    if (code !== adminConfig.accessCode) {
      return NextResponse.json(
        { ok: false, error: "Code d'accès requis." },
        { status: 401 }
      );
    }

    const results: string[] = [];

    // 1. Table MarketData
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "MarketData" (
          id TEXT PRIMARY KEY,
          platform TEXT NOT NULL,
          pair TEXT NOT NULL,
          price DOUBLE PRECISION NOT NULL,
          bid DOUBLE PRECISION,
          ask DOUBLE PRECISION,
          volume24h DOUBLE PRECISION,
          "rawData" TEXT,
          "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "MarketData_platform_pair_idx" ON "MarketData"("platform", "pair")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "MarketData_fetchedAt_idx" ON "MarketData"("fetchedAt")`;
      results.push("✅ Table MarketData créée");
    } catch (e) {
      results.push(`⚠️ MarketData: ${e instanceof Error ? e.message : "erreur"}`);
    }

    // 2. Table DetectedOpportunity
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "DetectedOpportunity" (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          "automationLevel" TEXT NOT NULL DEFAULT 'semi_auto',
          "buyPlatform" TEXT NOT NULL,
          "sellPlatform" TEXT NOT NULL,
          pair TEXT NOT NULL,
          "buyPrice" DOUBLE PRECISION NOT NULL,
          "sellPrice" DOUBLE PRECISION NOT NULL,
          "spreadPercent" DOUBLE PRECISION NOT NULL,
          "estimatedGain" DOUBLE PRECISION NOT NULL,
          "estimatedGainPercent" DOUBLE PRECISION NOT NULL,
          "capitalRequired" DOUBLE PRECISION NOT NULL,
          "approvalStatus" TEXT NOT NULL DEFAULT 'pending',
          "dryRun" BOOLEAN NOT NULL DEFAULT TRUE,
          "validUntil" TIMESTAMP(3) NOT NULL,
          "riskLevel" TEXT NOT NULL DEFAULT 'low',
          description TEXT NOT NULL,
          "rawData" TEXT,
          "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "approvedAt" TIMESTAMP(3),
          "approvedBy" TEXT,
          "expiresAt" TIMESTAMP(3)
        )
      `;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "DetectedOpportunity_approvalStatus_idx" ON "DetectedOpportunity"("approvalStatus")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "DetectedOpportunity_automationLevel_idx" ON "DetectedOpportunity"("automationLevel")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "DetectedOpportunity_detectedAt_idx" ON "DetectedOpportunity"("detectedAt")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "DetectedOpportunity_type_idx" ON "DetectedOpportunity"("type")`;
      results.push("✅ Table DetectedOpportunity créée");
    } catch (e) {
      results.push(`⚠️ DetectedOpportunity: ${e instanceof Error ? e.message : "erreur"}`);
    }

    // 3. Table ScanLog
    try {
      await db.$executeRaw`
        CREATE TABLE IF NOT EXISTS "ScanLog" (
          id TEXT PRIMARY KEY,
          trigger TEXT NOT NULL,
          status TEXT NOT NULL,
          "platformsScanned" TEXT NOT NULL,
          "opportunitiesFound" INTEGER NOT NULL DEFAULT 0,
          "opportunitiesApproved" INTEGER NOT NULL DEFAULT 0,
          duration INTEGER NOT NULL DEFAULT 0,
          error TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "ScanLog_createdAt_idx" ON "ScanLog"("createdAt")`;
      await db.$executeRaw`CREATE INDEX IF NOT EXISTS "ScanLog_status_idx" ON "ScanLog"("status")`;
      results.push("✅ Table ScanLog créée");
    } catch (e) {
      results.push(`⚠️ ScanLog: ${e instanceof Error ? e.message : "erreur"}`);
    }

    // 4. Vérifier les tables existantes
    let tables: string[] = [];
    try {
      const result = await db.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
      `;
      tables = result.map((r) => r.tablename);
    } catch {
      // ignore
    }

    return NextResponse.json({
      ok: true,
      message: "Migration terminée",
      results,
      tables,
    });
  } catch (err) {
    console.error("[migrate] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}
