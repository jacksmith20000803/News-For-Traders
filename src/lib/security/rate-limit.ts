interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 10_000;

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Evict oldest entries if store grows too large (DoS protection)
  if (store.size >= MAX_STORE_SIZE) {
    const oldest = store.keys().next().value;
    if (oldest) store.delete(oldest);
  }

  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { success: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return {
    success: true,
    remaining: maxRequests - entry.count,
    resetAt: entry.resetAt,
  };
}

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) {
        store.delete(key);
      }
    }
  }, 60_000);
}

/**
 * Extract client IP. When TRUST_PROXY=true, reads x-forwarded-for (first hop).
 * Without TRUST_PROXY, only x-real-ip is trusted to prevent spoofing.
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true";

  if (trustProxy) {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0]?.trim() ?? "unknown";
    }
  }

  return request.headers.get("x-real-ip") ?? "127.0.0.1";
}

/** Placeholder for Redis/KV adapter — swap in production multi-instance deployments. */
export interface RateLimitAdapter {
  check(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
}

export class InMemoryRateLimitAdapter implements RateLimitAdapter {
  async check(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
    return checkRateLimit(key, max, windowMs);
  }
}

export const rateLimitAdapter: RateLimitAdapter = new InMemoryRateLimitAdapter();
