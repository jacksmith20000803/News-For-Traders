"use client";

let cachedCsrfToken: string | null = null;

/** Fetch and cache the CSRF token for mutating API requests. */
export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  const res = await fetch("/api/auth/me", { credentials: "same-origin" });
  const json = await res.json();
  cachedCsrfToken = json.data?.csrfToken ?? "";
  return cachedCsrfToken ?? "";
}

export function clearCsrfCache() {
  cachedCsrfToken = null;
}

/** Authenticated fetch with CSRF header. */
export async function secureFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const csrfToken = await getCsrfToken();
  return fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "x-csrf-token": csrfToken,
      ...options.headers,
    },
  });
}

/** Log out the current user and redirect to home. */
export async function logout(): Promise<void> {
  await secureFetch("/api/auth/logout", { method: "POST" });
  clearCsrfCache();
  window.location.href = "/";
}
