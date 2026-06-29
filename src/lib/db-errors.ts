import { inspect } from "node:util";

export function isDatabaseConnectivityError(error: unknown) {
  const text = [
    typeof error === "string" ? error : "",
    error instanceof Error ? error.message : "",
    error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code) : "",
    inspect(error, { depth: 3 }),
  ].join(" ");

  return /ENOTFOUND|getaddrinfo|EAI_AGAIN|ECONNRESET|ETIMEDOUT|EACCES|connect\s+EACCES|WebSocket|neon\.tech|database.*connect/i.test(text);
}
