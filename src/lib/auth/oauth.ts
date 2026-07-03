import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { decodeJwt, jwtVerify, createRemoteJWKSet } from "jose";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo";

const GITHUB_AUTH = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN = "https://github.com/login/oauth/access_token";
const GITHUB_USER = "https://api.github.com/user";
const GITHUB_EMAIL = "https://api.github.com/user/emails";

const DISCORD_AUTH = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN = "https://discord.com/api/oauth2/token";
const DISCORD_USER = "https://discord.com/api/users/@me";

const TELEGRAM_AUTH = "https://oauth.telegram.org/auth";
const TELEGRAM_TOKEN = "https://oauth.telegram.org/token";
const TELEGRAM_JWKS = createRemoteJWKSet(new URL("https://oauth.telegram.org/.well-known/jwks.json"));

export function isGoogleOAuthConfigured() {
  return !!(config.oauth.google.clientId && config.oauth.google.clientSecret);
}

export function isGitHubOAuthConfigured() {
  return !!(config.oauth.github.clientId && config.oauth.github.clientSecret);
}

export function isDiscordOAuthConfigured() {
  return !!(config.oauth.discord.clientId && config.oauth.discord.clientSecret);
}

export function isTelegramOAuthConfigured() {
  return !!(config.oauth.telegram.clientId && config.oauth.telegram.clientSecret);
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

export function getDiscordAuthUrl(state: string, baseUrl?: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.discord.clientId,
    redirect_uri: redirectUri("discord", baseUrl),
    response_type: "code",
    scope: "identify email",
    state,
  });
  return `${DISCORD_AUTH}?${params}`;
}

export function getTelegramAuthUrl(state: string, baseUrl?: string, codeChallenge?: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.telegram.clientId,
    redirect_uri: redirectUri("telegram", baseUrl),
    response_type: "code",
    scope: "openid profile",
    state,
  });
  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }
  return `${TELEGRAM_AUTH}?${params}`;
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
  const linkedAccount = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: params.provider,
        providerAccountId: params.providerAccountId,
      },
    },
    include: { user: true },
  });
  let user = linkedAccount?.user ?? (await db.user.findUnique({ where: { email } }));

  if (user?.isBanned || user?.isSuspended) {
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
  } else if (user.deletedAt || !user.emailVerified || user.avatar === null) {
    user = await db.user.update({
      where: { id: user.id },
      data: {
        deletedAt: null,
        emailVerified: user.emailVerified ?? new Date(),
        avatar: user.avatar ?? params.avatar,
        name: user.name || params.name,
      },
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

export async function handleDiscordCallback(code: string, baseUrl?: string) {
  const tokenRes = await fetch(DISCORD_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.discord.clientId,
      client_secret: config.oauth.discord.clientSecret,
      redirect_uri: redirectUri("discord", baseUrl),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to exchange Discord token");
  const tokens = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch(DISCORD_USER, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!profileRes.ok) throw new Error("Failed to fetch Discord profile");

  const profile = (await profileRes.json()) as {
    id: string;
    username?: string;
    global_name?: string | null;
    email?: string | null;
    avatar?: string | null;
  };
  if (!profile.email) throw new Error("Discord account has no verified email");
  const avatar = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=256`
    : null;

  return linkOAuthUser({
    email: profile.email,
    name: profile.global_name ?? profile.username ?? profile.email.split("@")[0],
    avatar,
    provider: "discord",
    providerAccountId: profile.id,
    accessToken: tokens.access_token,
  });
}

export async function handleTelegramCallback(code: string, codeVerifier: string | undefined, baseUrl?: string) {
  const tokenRes = await fetch(TELEGRAM_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.telegram.clientId,
      client_secret: config.oauth.telegram.clientSecret,
      redirect_uri: redirectUri("telegram", baseUrl),
      grant_type: "authorization_code",
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    }),
  });

  if (!tokenRes.ok) throw new Error("Failed to exchange Telegram token");
  const tokens = (await tokenRes.json()) as {
    access_token?: string;
    id_token?: string;
  };
  if (!tokens.id_token) throw new Error("Telegram did not return an identity token");

  const claims = await verifyTelegramIdToken(tokens.id_token);
  const providerAccountId = typeof claims.sub === "string" ? claims.sub : null;
  if (!providerAccountId) throw new Error("Telegram account has no stable identifier");

  const username = typeof claims.preferred_username === "string" ? claims.preferred_username : null;
  const name = typeof claims.name === "string" ? claims.name : username;
  const picture = typeof claims.picture === "string" ? claims.picture : null;
  const email =
    typeof claims.email === "string"
      ? claims.email
      : `telegram-${providerAccountId}@telegram.tradx.local`;

  return linkOAuthUser({
    email,
    name: name || username || `Telegram ${providerAccountId}`,
    avatar: picture,
    provider: "telegram",
    providerAccountId,
    accessToken: tokens.access_token,
  });
}

async function verifyTelegramIdToken(idToken: string) {
  const unsafeClaims = decodeJwt(idToken);
  const issuer = typeof unsafeClaims.iss === "string" ? unsafeClaims.iss : "https://oauth.telegram.org";
  const { payload } = await jwtVerify(idToken, TELEGRAM_JWKS, {
    issuer,
    audience: config.oauth.telegram.clientId,
  });
  return payload;
}
