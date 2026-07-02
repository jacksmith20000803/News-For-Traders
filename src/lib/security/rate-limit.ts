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

function normalizeIp(value: string | null): string | null {
  if (!value) return null;
  const candidate = value.trim();
  if (!candidate) return null;
  if (candidate.startsWith("[") && candidate.includes("]")) return candidate.slice(1, candidate.indexOf("]"));
  if (candidate.startsWith("::ffff:")) return candidate.slice(7);
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) return candidate.replace(/:\d+$/, "");
  return candidate.replace(/^"|"$/g, "");
}

function isPrivateIp(ip: string) {
  const lower = ip.toLowerCase();
  if (lower === "localhost" || lower === "::1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;

  const parts = lower.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function parseForwardedFor(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => normalizeIp(part))
    .filter((ip): ip is string => Boolean(ip));
}

function parseForwardedHeader(value: string | null) {
  if (!value) return [];
  return value
    .split(",")
    .flatMap((segment) => {
      const match = /for="?([^;,"]+)/i.exec(segment);
      return match?.[1] ? [normalizeIp(match[1])] : [];
    })
    .filter((ip): ip is string => Boolean(ip));
}

function firstPublicIp(candidates: string[]) {
  return candidates.find((ip) => !isPrivateIp(ip)) ?? candidates[0] ?? null;
}

/**
 * Extract the best available client IP from common hosting/proxy headers.
 * Set TRUST_PROXY=false to ignore forwarded headers in private deployments.
 */
export function getClientIp(request: Request): string {
  const trustProxy = process.env.NODE_ENV === "production"
    ? process.env.DISABLE_TRUST_PROXY !== "true"
    : process.env.TRUST_PROXY !== "false";

  if (trustProxy) {
    const candidates: string[] = [];
    const directHeaders = ["cf-connecting-ip", "true-client-ip", "x-client-ip", "x-real-ip", "fastly-client-ip"];
    for (const header of directHeaders) {
      const ip = normalizeIp(request.headers.get(header));
      if (ip) candidates.push(ip);
    }

    candidates.push(
      ...parseForwardedFor(request.headers.get("x-forwarded-for")),
      ...parseForwardedFor(request.headers.get("x-render-forwarded-for")),
      ...parseForwardedFor(request.headers.get("x-vercel-forwarded-for")),
      ...parseForwardedHeader(request.headers.get("forwarded"))
    );

    const ip = firstPublicIp(candidates);
    if (ip) return ip;
  }

  return normalizeIp(request.headers.get("x-real-ip")) ?? "127.0.0.1";
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
