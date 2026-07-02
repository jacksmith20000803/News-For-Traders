import "dotenv/config";
import nodemailer from "nodemailer";

type Provider = "google" | "github" | "discord" | "telegram";

const providers: Provider[] = ["google", "github", "discord", "telegram"];

const providerEnv: Record<Provider, { clientId: string; clientSecret: string }> = {
  google: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
  github: { clientId: "GITHUB_CLIENT_ID", clientSecret: "GITHUB_CLIENT_SECRET" },
  discord: { clientId: "DISCORD_CLIENT_ID", clientSecret: "DISCORD_CLIENT_SECRET" },
  telegram: { clientId: "TELEGRAM_CLIENT_ID", clientSecret: "TELEGRAM_CLIENT_SECRET" },
};

const argUrl = process.argv.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));
const shouldCheckSmtp = process.argv.includes("--smtp");
const baseUrl = normalizeUrl(argUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");

async function main() {
  console.log(`Auth deployment check for ${baseUrl}`);
  console.log("");

  printEnvironmentSummary();
  console.log("");
  printExpectedCallbackUrls();
  console.log("");

  await checkEndpoint("/api/auth/me", "GET /api/auth/me should return JSON", 200);
  await checkEndpoint("/api/auth/verify-email", "GET /api/auth/verify-email without token should return JSON 400", 400);

  for (const provider of providers) {
    await checkOAuthStart(provider);
  }

  if (shouldCheckSmtp) {
    await checkSmtpConnection();
  } else {
    console.log("");
    console.log("SMTP connection check skipped. Run with --smtp to verify SMTP login without sending email.");
  }
}

function printEnvironmentSummary() {
  console.log("Environment summary");
  console.log(`- NEXT_PUBLIC_APP_URL: ${baseUrl}`);
  console.log(`- DATABASE_URL: ${flag("DATABASE_URL")}`);
  console.log(`- SESSION_SECRET: ${strongSecret("SESSION_SECRET")}`);
  console.log(`- CSRF_SECRET: ${strongSecret("CSRF_SECRET")}`);
  console.log(`- SMTP_HOST: ${flag("SMTP_HOST")}`);
  console.log(`- SMTP_PORT: ${process.env.SMTP_PORT || "(not set)"}`);
  console.log(`- SMTP_USER: ${flag("SMTP_USER")}`);
  console.log(`- SMTP_PASS/SMTP_PASSWORD: ${Boolean(process.env.SMTP_PASS || process.env.SMTP_PASSWORD) ? "set" : "missing"}`);
  console.log(`- EMAIL_FROM: ${flag("EMAIL_FROM")}`);

  for (const provider of providers) {
    const env = providerEnv[provider];
    const configured = Boolean(process.env[env.clientId] && process.env[env.clientSecret]);
    console.log(`- ${provider.toUpperCase()} OAuth: ${configured ? "configured" : `missing ${missingKeys([env.clientId, env.clientSecret]).join(", ")}`}`);
  }
}

function printExpectedCallbackUrls() {
  console.log("Use exactly these callback URLs in provider dashboards");
  for (const provider of providers) {
    console.log(`- ${provider}: ${baseUrl}/api/auth/oauth/${provider}/callback`);
  }
}

async function checkEndpoint(path: string, label: string, expectedStatus: number) {
  const url = `${baseUrl}${path}`;
  try {
    const response = await fetch(url, { redirect: "manual", cache: "no-store" });
    const contentType = response.headers.get("content-type") ?? "";
    const ok = response.status === expectedStatus && contentType.includes("application/json");
    console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
    console.log(`  status=${response.status} content-type=${contentType || "(none)"}`);
    if (!ok) {
      console.log(`  url=${url}`);
    }
  } catch (error) {
    console.log(`FAIL ${label}`);
    console.log(`  ${formatError(error)}`);
    console.log(`  url=${url}`);
  }
}

async function checkOAuthStart(provider: Provider) {
  const env = providerEnv[provider];
  const configured = Boolean(process.env[env.clientId] && process.env[env.clientSecret]);
  const url = `${baseUrl}/api/auth/oauth/${provider}?returnTo=${encodeURIComponent("/dashboard")}&authPage=${encodeURIComponent("/login")}`;

  try {
    const response = await fetch(url, { redirect: "manual", cache: "no-store" });
    const location = response.headers.get("location") ?? "";
    const redirectStatus = response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308;
    const expectedUnconfigured = !configured && location.includes("oauth_not_configured");
    const expectedConfigured = configured && redirectStatus && isProviderLocation(provider, location);
    const ok = expectedUnconfigured || expectedConfigured;

    console.log(`${ok ? "PASS" : "FAIL"} OAuth start: ${provider}`);
    console.log(`  status=${response.status}`);
    console.log(`  location=${redactUrl(location) || "(none)"}`);
    if (!ok) {
      if (!redirectStatus) console.log("  expected a redirect response");
      if (configured) console.log(`  expected redirect to ${provider} OAuth provider`);
      if (!configured) console.log("  expected local oauth_not_configured redirect because env keys are missing");
      console.log(`  url=${url}`);
    }
  } catch (error) {
    console.log(`FAIL OAuth start: ${provider}`);
    console.log(`  ${formatError(error)}`);
    console.log(`  url=${url}`);
  }
}

async function checkSmtpConnection() {
  console.log("");
  console.log("SMTP connection check");

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD;
  const port = Number.parseInt(process.env.SMTP_PORT ?? "587", 10);

  if (!host || !user || !pass || Number.isNaN(port)) {
    console.log("FAIL SMTP env is incomplete. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.");
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    await transporter.verify();
    console.log("PASS SMTP login verified. This does not send an email.");
  } catch (error) {
    console.log("FAIL SMTP login failed.");
    console.log(`  ${formatError(error)}`);
  }
}

function isProviderLocation(provider: Provider, location: string) {
  if (!location) return false;
  if (provider === "google") return location.startsWith("https://accounts.google.com/");
  if (provider === "github") return location.startsWith("https://github.com/login/oauth/");
  if (provider === "discord") return location.startsWith("https://discord.com/oauth2/");
  if (provider === "telegram") return location.startsWith("https://oauth.telegram.org/");
  return false;
}

function normalizeUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function flag(key: string) {
  return process.env[key] ? "set" : "missing";
}

function strongSecret(key: string) {
  const value = process.env[key];
  if (!value) return "missing";
  return value.length >= 32 ? "set" : "too short";
}

function missingKeys(keys: string[]) {
  return keys.filter((key) => !process.env[key]);
}

function redactUrl(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (["client_id", "client_secret", "code", "state"].includes(key)) {
        url.searchParams.set(key, "[redacted]");
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

function formatError(error: unknown) {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

main().catch((error) => {
  console.error("Auth deployment check failed unexpectedly.");
  console.error(formatError(error));
  process.exitCode = 1;
});
