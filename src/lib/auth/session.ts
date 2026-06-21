import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { config } from "@/lib/config";

const SESSION_COOKIE = "nft_session";
const CSRF_COOKIE = "nft_csrf";

/** Cookie names exported for middleware cleanup. */
export { SESSION_COOKIE, CSRF_COOKIE };

/** JWT payload — role is intentionally excluded; always read from DB. */
export interface SessionPayload {
  userId: string;
  sessionId: string;
}

const secret = new TextEncoder().encode(config.security.sessionSecret);

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${config.security.sessionMaxAge}s`)
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: config.security.sessionMaxAge,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  const session = await db.session.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          avatar: true,
          bio: true,
          reputation: true,
          contributionCount: true,
          emailVerified: true,
          twoFactorEnabled: true,
          isSuspended: true,
          isBanned: true,
          deletedAt: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date()) {
    return null;
  }

  if (session.userId !== payload.userId) {
    return null;
  }

  if (session.user.deletedAt || session.user.isBanned || session.user.isSuspended) {
    return null;
  }

  return session.user;
}

export async function createUserSession(
  userId: string,
  ipAddress?: string,
  userAgent?: string
) {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + config.security.sessionMaxAge * 1000);

  const session = await db.session.create({
    data: {
      userId,
      token: sessionToken,
      expiresAt,
      ipAddress,
      userAgent,
    },
  });

  const jwt = await createSessionToken({
    userId,
    sessionId: session.id,
  });

  await setSessionCookie(jwt);
  return session;
}

function generateSessionToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function destroySession(): Promise<void> {
  const token = await getSessionToken();
  if (token) {
    const payload = await verifySessionToken(token);
    if (payload?.sessionId) {
      await db.session.delete({ where: { id: payload.sessionId } }).catch(() => {});
    }
  }
  await clearSessionCookie();
}

export async function destroyOtherSessions(userId: string, currentSessionId: string) {
  await db.session.deleteMany({
    where: { userId, id: { not: currentSessionId } },
  });
}

export async function getCurrentSessionId(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const payload = await verifySessionToken(token);
  return payload?.sessionId ?? null;
}

export async function setCsrfCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: config.security.sessionMaxAge,
    path: "/",
  });
}

export async function getCsrfTokenFromCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(CSRF_COOKIE)?.value;
}

export async function getOrCreateCsrfToken(): Promise<string> {
  const { createSignedCsrfToken } = await import("@/lib/security/csrf");
  const existing = await getCsrfTokenFromCookie();
  if (existing && (await import("@/lib/security/csrf")).verifyCsrfToken(existing)) {
    return existing;
  }
  const token = createSignedCsrfToken();
  await setCsrfCookie(token);
  return token;
}

export function toSafeUser(user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar,
    bio: user.bio,
    reputation: user.reputation,
    contributionCount: user.contributionCount,
    emailVerified: user.emailVerified,
    twoFactorEnabled: user.twoFactorEnabled,
    createdAt: user.createdAt,
  };
}
