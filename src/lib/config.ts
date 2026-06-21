/**
 * Validates required secrets at module load in production.
 * Fails fast rather than running with insecure defaults.
 */
function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;

  const required = ["SESSION_SECRET", "CSRF_SECRET", "DATABASE_URL"] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(", ")}`
    );
  }

  for (const key of ["SESSION_SECRET", "CSRF_SECRET"] as const) {
    const value = process.env[key]!;
    if (value.length < 32) {
      throw new Error(`${key} must be at least 32 characters in production`);
    }
    if (value.includes("change-in-production") || value.includes("dev-")) {
      throw new Error(`${key} appears to be a development default — set a secure value`);
    }
  }
}

assertProductionSecrets();

export const config = {
  app: {
    name: process.env.APP_NAME ?? "MarketPulse",
    url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  },
  security: {
    sessionSecret:
      process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production",
    csrfSecret:
      process.env.CSRF_SECRET ?? "dev-csrf-secret-change-in-production",
    sessionMaxAge: 60 * 60 * 24 * 7,
    maxLoginAttempts: 5,
    lockoutDurationMs: 15 * 60 * 1000,
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "100", 10),
    authMaxRequests: parseInt(process.env.AUTH_RATE_LIMIT_MAX ?? "5", 10),
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  features: {
    maintenanceMode: process.env.MAINTENANCE_MODE === "true",
  },
  cronSecret: process.env.CRON_SECRET ?? "",
  ai: {
    apiKey: process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? "",
    baseUrl: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
  },
} as const;

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
