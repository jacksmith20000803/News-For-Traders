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

export function isGoogleOAuthConfigured() {
  return !!(config.oauth.google.clientId && config.oauth.google.clientSecret);
}

export function isGitHubOAuthConfigured() {
  return !!(config.oauth.github.clientId && config.oauth.github.clientSecret);
}

function redirectUri(provider: string) {
  return `${config.app.url}/api/auth/oauth/${provider}/callback`;
}

export function getGoogleAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.google.clientId,
    redirect_uri: redirectUri("google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH}?${params}`;
}

export function getGitHubAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: config.oauth.github.clientId,
    redirect_uri: redirectUri("github"),
    scope: "user:email",
    state,
  });
  return `${GITHUB_AUTH}?${params}`;
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

  await createUserSession(user.id);
  const csrf = createSignedCsrfToken();
  await setCsrfCookie(csrf);

  return user;
}

export async function handleGoogleCallback(code: string) {
  const tokenRes = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.oauth.google.clientId,
      client_secret: config.oauth.google.clientSecret,
      redirect_uri: redirectUri("google"),
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

export async function handleGitHubCallback(code: string) {
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
      redirect_uri: redirectUri("github"),
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
