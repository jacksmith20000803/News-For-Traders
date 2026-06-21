import { db } from "@/lib/db";
import { config } from "@/lib/config";

const CACHE_TTL_MS = 10_000;
const cache = new Map<string, { value: string; expiresAt: number }>();

async function getCachedSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const setting = await db.siteSetting.findUnique({ where: { key } });
  const value = setting?.value ?? null;
  if (value !== null) {
    cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
  }
  return value;
}

export function invalidateSettingsCache(key?: string) {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}

/** Returns true when maintenance mode is active (DB setting or env override). */
export async function isMaintenanceModeEnabled(): Promise<boolean> {
  if (config.features.maintenanceMode) return true;

  try {
    const dbValue = await getCachedSetting("maintenance_mode");
    return dbValue === "true";
  } catch {
    // Fail open — if DB is unavailable, don't block the entire site
    return false;
  }
}

export async function getSiteSetting(key: string): Promise<string | null> {
  return getCachedSetting(key);
}

export async function isFeatureEnabled(key: string): Promise<boolean> {
  const flag = await db.featureFlag.findUnique({ where: { key } });
  return flag?.enabled ?? false;
}
