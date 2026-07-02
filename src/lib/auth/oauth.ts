import { db } from "@/lib/db";
import { createUserSession, setCsrfCookie } from "@/lib/auth/session";
import { createSignedCsrfToken } from "@/lib/security/csrf";
import { config } from "@/lib/config";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

const GITHUB_AUTH = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER = "https://api.github.com/user";
const GITHUB_EMAIL = "https://api.github.com/user/emails";

const APPLE_AUTH = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN = "https://appleid.apple.com/auth/token";

function microsoftAuthBase() {
  return `https://login.microsoftonline.com/${encodeURIComponent(config.oauth.microsoft.tenant)}/oauth2/v2.0`;
}

export function isGoogleOAuthConfigured() {
  return !!(config.oauth.google.clientId && config.oauth.google.clientSecret);
}

export function isGitHubOAuthConfigured() {
  return !!(config.oauth.github.clientId && config.oauth.github.clientSecret);
}

export function isMicrosoftOAuthConfigured() {
  return !!(config.oauth.microsoft.clientId && config.oauth.microsoft.clientSecret);
}

export function isAppleOAuthConfigured() {
  return !!(config.oauth.apple.clientId && config.oauth.apple.clientSecret);
}

function redirectUri(provider: string, baseUrl = config.app.url) {
  return `${baseUrl.replace(/\/+$/, "")}/api/auth/oauth/${provider}/callback`;
}

export function getOAuthCallbackUrl(provider: string, baseUrl = config.app.url) {
  return redirectUri(provider, baseUrl);
}

export function getGoogleAuthUrl(state: string, baseUrl?: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.google.clientId,
    redirect_uri: redirectUri("google", baseUrl),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params}`;
}

export function getGitHubAuthUrl(state: string, baseUrl?: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.github.clientId,
    redirect_uri: redirectUri("github", baseUrl),
    scope: "user:email",
    state,
  });
  return `${GITHUB_AUTH}?${params}`;
}

export function getMicrosoftAuthUrl(state: string, baseUrl?: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.microsoft.clientId,
    redirect_uri: redirectUri("microsoft", baseUrl),
    response_type: "code",
    scope: "openid profile email User.Read",
    state,
    prompt: "select_account",
  });
  return `${microsoftAuthBase()}/authorize?${params}`;
}

export function getAppleAuthUrl(state: string, baseUrl?: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.apple.clientId,
    redirect_uri: redirectUri("apple", baseUrl),
    response_type: "code",
    response_mode: "form_post",
    scope: "name email",
    state,
  });
  return `${APPLE_AUTH}?${params}`;
}

async function linkOAuthUser(params: {
  email: string;
  name: string;
  avatar?: string | null;
  provider: string;
  providerAccountId: string;
  accessToken?: string;
}) {
  const email = params.email.toLowerCase();
  let user = await db.user.findUnique({ where: { email } });

  if (user?.isBanned || user?.deletedAt) {
    throw new Error("Account is not available");
  }

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: params.name,
        avatar: params.avatar,
        emailVerified: new Date(),
      },
    });
  } else if (!user.emailVerified) {
    user = await db.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date(), avatar: user.avatar ?? params.avatar },
    });
  }

  await db.oAuthAccount.upsert({
    where: {
      provider_providerAccountId: {
        provider: params.provider,
        providerAccountId: params.providerAccountId,
      },
    },
    create: {
      userId: user.id,
      provider: params.provider,
      providerAccountId: params.providerAccountId,
      accessToken: params.accessToken,
    },
    update: { accessToken: params.accessToken },
  });

  await createUserSession(user.id, undefined, undefined, {
    mfaVerified: false,
    authTime: Math.floor(Date.now() / 1000),
    emailVerified: true,
  });
  const csrf = createSignedCsrfToken();
  await setCsrfCookie(csrf);

  return user;
}

export async function handleGoogleCallback(code: string, baseUrl?: string) {
  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: redirectUri("google", baseUrl),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to exchange Google token");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const userRes = await fetch(GOOGLE_USERINFO, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userRes.ok) throw new Error("Failed to fetch Google profile");

  const profile = (await userRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  if (!profile.email) throw new Error("Google account has no email");

  return linkOAuthUser({
    email: profile.email,
    name: profile.name ?? profile.email.split("@")[0],
    avatar: profile.picture,
    provider: "google",
    providerAccountId: profile.sub,
    accessToken: tokens.access_token,
  });
}

export async function handleGitHubCallback(code: string, baseUrl?: string) {
  const tokenRes = await fetch(GITHUB_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.github.clientId,
      client_secret: config.oauth.github.clientSecret,
      redirect_uri: redirectUri("github", baseUrl),
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to exchange GitHub token");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const [userRes, emailRes] = await Promise.all([
    fetch(GITHUB_USER, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/json",
      },
    }),
    fetch(GITHUB_EMAIL, {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/json",
      },
    }),
  ]);

  if (!userRes.ok) throw new Error("Failed to fetch GitHub profile");

  const profile = (await userRes.json()) as {
    id: number;
    login: string;
    name?: string;
    avatar_url?: string;
    email?: string;
  };

  let email = profile.email;
  if (!email && emailRes.ok) {
    const emails = (await emailRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
    email = emails.find((e) => e.primary && e.verified)?.email ?? emails[0]?.email;
  }

  if (!email) throw new Error("GitHub account has no public email");

  return linkOAuthUser({
    email,
    name: profile.name ?? profile.login,
    avatar: profile.avatar_url,
    provider: "github",
    providerAccountId: String(profile.id),
    accessToken: tokens.access_token,
  });
}

export async function handleMicrosoftCallback(code: string, baseUrl?: string) {
  const tokenRes = await fetch(`${microsoftAuthBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.microsoft.clientId,
      client_secret: config.oauth.microsoft.clientSecret,
      redirect_uri: redirectUri("microsoft", baseUrl),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to exchange Microsoft token");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error("Failed to fetch Microsoft profile");

  const profile = (await profileRes.json()) as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
  const email = profile.mail ?? profile.userPrincipalName;
  if (!email) throw new Error("Microsoft account has no email");

  return linkOAuthUser({
    email,
    name: profile.displayName ?? email.split("@")[0],
    provider: "microsoft",
    providerAccountId: profile.id,
    accessToken: tokens.access_token,
  });
}

export async function handleAppleCallback(code: string, userJson?: string | null, baseUrl?: string) {
  const tokenRes = await fetch(APPLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.apple.clientId,
      client_secret: config.oauth.apple.clientSecret,
      redirect_uri: redirectUri("apple", baseUrl),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to exchange Apple token");
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
  };

  const claims = decodeJwtPayload(tokens.id_token);
  const email = typeof claims.email === "string" ? claims.email : null;
  const providerAccountId = typeof claims.sub === "string" ? claims.sub : null;

  if (!email || !providerAccountId) throw new Error("Apple account has no email");

  const appleUser = parseAppleUser(userJson);
  const name = [appleUser?.name?.firstName, appleUser?.name?.lastName].filter(Boolean).join(" ");

  return linkOAuthUser({
    email,
    name: name || email.split("@")[0],
    provider: "apple",
    providerAccountId,
    accessToken: tokens.access_token,
  });
}

function decodeJwtPayload(token: string | null | undefined): Record<string, unknown> {
  if (!token) return {};
  const [, payload] = token.split(".");
  if (!payload) return {};

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseAppleUser(value: string | null | undefined): { name?: { firstName?: string; lastName?: string } } | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as { name?: { firstName?: string; lastName?: string } };
  } catch {
    return null;
  }
}
