import {
  MAX_CODE_REQUESTS_PER_MINUTE,
} from "@/lib/verification/constants";

interface RequestRecord {
  timestamps: number[];
}

const requestsByUser = new Map<string, RequestRecord>();
const WINDOW_MS = 60 * 1000;

// TODO: Replace in-memory Maps with Upstash Redis (@upstash/redis) for production multi-instance support.
export function recordCodeRequest(userId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
  error?: string;
} {
  const now = Date.now();
  const record = requestsByUser.get(userId) ?? { timestamps: [] };
  record.timestamps = record.timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);

  if (record.timestamps.length >= MAX_CODE_REQUESTS_PER_MINUTE) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
    requestsByUser.set(userId, record);
    return {
      allowed: false,
      retryAfterSeconds,
      error: "Too many verification email requests. Please try again in a minute.",
    };
  }

  record.timestamps.push(now);
  requestsByUser.set(userId, record);
  return { allowed: true };
}

export function getCooldownRemaining(userId: string): number {
  const record = requestsByUser.get(userId);
  if (!record || record.timestamps.length < MAX_CODE_REQUESTS_PER_MINUTE) return 0;
  const oldest = record.timestamps[0];
  return Math.max(0, Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 1000));
}

export function clearRateLimits(userId: string): void {
  requestsByUser.delete(userId);
}
