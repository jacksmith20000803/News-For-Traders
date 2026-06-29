"use client";

let cachedCsrfToken: string | null = null;
const CSRF_COOKIE = "nft_csrf";

export async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();

  if (!text) return null as T;

  if (!contentType.includes("application/json")) {
    const preview = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      `Expected JSON but received ${contentType || "unknown content"} from ${response.url || "request"}: ${preview}`
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${response.url || "request"}`);
  }
}

function readBrowserCookie(name: string): string {
  if (typeof document === "undefined") return "";

  const encodedName = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));

  if (!cookie) return "";

  try {
    return decodeURIComponent(cookie.slice(encodedName.length));
  } catch {
    return cookie.slice(encodedName.length);
  }
}

/** Fetch and cache the CSRF token for mutating API requests. */
export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  try {
    const res = await fetch("/api/auth/me", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (res.ok) {
      const json = await readJsonResponse<{ data?: { csrfToken?: string } }>(res);
      cachedCsrfToken = json.data?.csrfToken ?? readBrowserCookie(CSRF_COOKIE);
    }
  } catch {
    cachedCsrfToken = readBrowserCookie(CSRF_COOKIE);
  }

  cachedCsrfToken ??= readBrowserCookie(CSRF_COOKIE);
  return cachedCsrfToken ?? "";
}

export function clearCsrfCache() {
  cachedCsrfToken = null;
}

export function setCsrfToken(token: string | null | undefined) {
  cachedCsrfToken = token || null;
}

/** Authenticated fetch with CSRF header. */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const request = async (csrfToken: string) =>
    fetch(url, {
      ...options,
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "x-csrf-token": csrfToken,
        ...options.headers,
      },
    });

  let response = await request(await getCsrfToken().catch(() => readBrowserCookie(CSRF_COOKIE)));
  if (response.status === 403) {
    clearCsrfCache();
    response = await request(await getCsrfToken().catch(() => readBrowserCookie(CSRF_COOKIE)));
  }

  return response;
}

/** Log out the current user and redirect to home. */
export async function logout(): Promise<void> {
  clearCsrfCache();
  try {
    await secureFetch("/api/auth/logout", { method: "POST" });
  } finally {
    clearCsrfCache();
    window.location.href = "/";
  }
}
