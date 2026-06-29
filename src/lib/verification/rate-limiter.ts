import {
  MAX_CODE_REQUESTS_PER_HOUR,
  VERIFICATION_CODE_COOLDOWN_SECONDS,
} from "@/lib/verification/constants";

interface RequestRecord {
  timestamps: number[];
}

const requestsByUser = new Map<string, RequestRecord>();
const HOUR_MS = 60 * 60 * 1000;

// TODO: Replace in-memory Maps with Upstash Redis (@upstash/redis) for production multi-instance support.
export function recordCodeRequest(userId: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
  error?: string;
} {
  const now = Date.now();
  const record = requestsByUser.get(userId) ?? { timestamps: [] };
  record.timestamps = record.timestamps.filter((timestamp) => now - timestamp < HOUR_MS);

  const lastRequestAt = record.timestamps[record.timestamps.length - 1];
  if (lastRequestAt) {
    const elapsedSeconds = Math.floor((now - lastRequestAt) / 1000);
    if (elapsedSeconds < VERIFICATION_CODE_COOLDOWN_SECONDS) {
      const retryAfterSeconds = VERIFICATION_CODE_COOLDOWN_SECONDS - elapsedSeconds;
      requestsByUser.set(userId, record);
      return {
        allowed: false,
        retryAfterSeconds,
        error: `Please wait ${retryAfterSeconds} seconds before requesting another code.`,
      };
    }
  }

  if (record.timestamps.length >= MAX_CODE_REQUESTS_PER_HOUR) {
    const oldest = record.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((HOUR_MS - (now - oldest)) / 1000));
    requestsByUser.set(userId, record);
    return {
      allowed: false,
      retryAfterSeconds,
      error: "Too many verification code requests. Please try again later.",
    };
  }

  record.timestamps.push(now);
  requestsByUser.set(userId, record);
  return { allowed: true };
}

export function getCooldownRemaining(userId: string): number {
  const record = requestsByUser.get(userId);
  const lastRequestAt = record?.timestamps.at(-1);
  if (!lastRequestAt) return 0;
  const elapsedSeconds = Math.floor((Date.now() - lastRequestAt) / 1000);
  return Math.max(0, VERIFICATION_CODE_COOLDOWN_SECONDS - elapsedSeconds);
}

export function clearRateLimits(userId: string): void {
  requestsByUser.delete(userId);
}
