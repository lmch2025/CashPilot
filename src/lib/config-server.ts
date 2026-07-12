// CashPilot - Config helpers (server-side)
// Read/write configuration from the Config table with type safety.

import { db } from "@/lib/db";
import {
  DEFAULT_ROBOT_CONFIG,
  DEFAULT_OPPORTUNITIES_CONFIG,
  DEFAULT_GLOBAL_CONFIG,
  DEFAULT_PLANS_CONFIG,
  DEFAULT_ADMIN_CONFIG,
  DEFAULT_DISTRIBUTION_CONFIG,
  DEFAULT_DISTRIBUTION_STATE,
  CONFIG_KEYS,
  type RobotConfig,
  type OpportunitiesConfig,
  type GlobalConfig,
  type PlanConfig,
  type AdminConfig,
  type DistributionConfig,
  type DistributionState,
  DEFAULT_AUTOMATION_CONFIG,
  type AutomationConfig,
} from "@/lib/config-defaults";

/**
 * Get a config value by key. If not in DB, returns the default and seeds it.
 * If in DB, merges with defaults so new fields are always present.
 */
async function getConfig<T>(key: string, defaultValue: T): Promise<T> {
  const row = await db.config.findUnique({ where: { key } });
  if (!row) {
    // Seed default
    await db.config.create({
      data: { key, value: JSON.stringify(defaultValue) },
    });
    return defaultValue;
  }
  try {
    const parsed = JSON.parse(row.value) as T;
    // Merge with defaults for objects (ensures new fields are present)
    if (
      defaultValue !== null &&
      typeof defaultValue === "object" &&
      !Array.isArray(defaultValue)
    ) {
      return { ...(defaultValue as object), ...(parsed as object) } as T;
    }
    return parsed;
  } catch {
    return defaultValue;
  }
}

/**
 * Set a config value.
 */
async function setConfig<T>(key: string, value: T): Promise<void> {
  await db.config.upsert({
    where: { key },
    update: { value: JSON.stringify(value) },
    create: { key, value: JSON.stringify(value) },
  });
}

export async function getRobotConfig(): Promise<RobotConfig> {
  return getConfig(CONFIG_KEYS.robot, DEFAULT_ROBOT_CONFIG);
}

export async function setRobotConfig(cfg: RobotConfig): Promise<void> {
  await setConfig(CONFIG_KEYS.robot, cfg);
}

export async function getOpportunitiesConfig(): Promise<OpportunitiesConfig> {
  return getConfig(CONFIG_KEYS.opportunities, DEFAULT_OPPORTUNITIES_CONFIG);
}

export async function setOpportunitiesConfig(cfg: OpportunitiesConfig): Promise<void> {
  await setConfig(CONFIG_KEYS.opportunities, cfg);
}

export async function getGlobalConfig(): Promise<GlobalConfig> {
  return getConfig(CONFIG_KEYS.global, DEFAULT_GLOBAL_CONFIG);
}

export async function setGlobalConfig(cfg: GlobalConfig): Promise<void> {
  await setConfig(CONFIG_KEYS.global, cfg);
}

export async function getPlansConfig(): Promise<PlanConfig[]> {
  return getConfig(CONFIG_KEYS.plans, DEFAULT_PLANS_CONFIG);
}

export async function setPlansConfig(plans: PlanConfig[]): Promise<void> {
  await setConfig(CONFIG_KEYS.plans, plans);
}

export async function getAdminConfig(): Promise<AdminConfig> {
  return getConfig(CONFIG_KEYS.admin, DEFAULT_ADMIN_CONFIG);
}

export async function setAdminConfig(cfg: AdminConfig): Promise<void> {
  await setConfig(CONFIG_KEYS.admin, cfg);
}

export async function getDistributionConfig(): Promise<DistributionConfig> {
  return getConfig(CONFIG_KEYS.distribution, DEFAULT_DISTRIBUTION_CONFIG);
}

export async function setDistributionConfig(cfg: DistributionConfig): Promise<void> {
  await setConfig(CONFIG_KEYS.distribution, cfg);
}

export async function getDistributionState(): Promise<DistributionState> {
  return getConfig(CONFIG_KEYS.distributionState, DEFAULT_DISTRIBUTION_STATE);
}

export async function setDistributionState(state: DistributionState): Promise<void> {
  await setConfig(CONFIG_KEYS.distributionState, state);
}

export async function getAutomationConfig(): Promise<AutomationConfig> {
  return getConfig(CONFIG_KEYS.automation, DEFAULT_AUTOMATION_CONFIG);
}

export async function setAutomationConfig(cfg: AutomationConfig): Promise<void> {
  await setConfig(CONFIG_KEYS.automation, cfg);
}

/**
 * Get all configs at once (for the admin dashboard).
 */
export async function getAllConfigs() {
  const [robot, opportunities, global, plans, admin, distribution, automation] = await Promise.all([
    getRobotConfig(),
    getOpportunitiesConfig(),
    getGlobalConfig(),
    getPlansConfig(),
    getAdminConfig(),
    getDistributionConfig(),
    getAutomationConfig(),
  ]);
  return { robot, opportunities, global, plans, admin, distribution, automation };
}
