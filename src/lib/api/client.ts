"use client";

let cachedCsrfToken: string | null = null;

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

/** Fetch and cache the CSRF token for mutating API requests. */
export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  const res = await fetch("/api/auth/me", {
    cache: "no-store",
    credentials: "same-origin",
  });
  const json = await readJsonResponse<{ data?: { csrfToken?: string } }>(res);
  cachedCsrfToken = json.data?.csrfToken ?? "";
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

  let response = await request(await getCsrfToken());
  if (response.status === 403) {
    clearCsrfCache();
    response = await request(await getCsrfToken());
  }

  return response;
}

/** Log out the current user and redirect to home. */
export async function logout(): Promise<void> {
  clearCsrfCache();
  await secureFetch("/api/auth/logout", { method: "POST" });
  clearCsrfCache();
  window.location.href = "/";
}
