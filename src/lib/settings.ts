import { db } from "@/lib/db";
import { config } from "@/lib/config";

const CACHE_TTL_MS = 60_000;
const SETTING_READ_TIMEOUT_MS = 350;
const cache = new Map<string, { value: string | null; expiresAt: number }>();

async function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeout = setTimeout(() => resolve(fallback), SETTING_READ_TIMEOUT_MS);
      }),
    ]);
  } catch {
    return fallback;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function getCachedSetting(key: string): Promise<string | null> {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const setting = await withTimeout(
    db.siteSetting.findUnique({ where: { key } }),
    null
  );
  const value = setting?.value ?? null;
  cache.set(key, { value, expiresAt: now + CACHE_TTL_MS });
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
  const flag = await withTimeout(
    db.featureFlag.findUnique({ where: { key } }),
    null
  );
  return flag?.enabled ?? false;
}
