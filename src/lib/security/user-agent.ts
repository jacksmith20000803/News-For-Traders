/** Parse user-agent for registration audit */
export function parseUserAgent(ua: string | null | undefined) {
  const agent = ua ?? "Unknown";
  const lower = agent.toLowerCase();

  let browser = "Unknown";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("firefox/")) browser = "Firefox";
  else if (lower.includes("safari/") && !lower.includes("chrome")) browser = "Safari";

  let os = "Unknown";
  if (lower.includes("windows")) os = "Windows";
  else if (lower.includes("mac os")) os = "macOS";
  else if (lower.includes("android")) os = "Android";
  else if (lower.includes("iphone") || lower.includes("ipad")) os = "iOS";
  else if (lower.includes("linux")) os = "Linux";

  let deviceType = "Desktop";
  if (lower.includes("mobile") || lower.includes("android")) deviceType = "Mobile";
  else if (lower.includes("tablet") || lower.includes("ipad")) deviceType = "Tablet";

  return { browser, os, deviceType, userAgent: agent.slice(0, 512) };
}

/** Best-effort geo from common proxy headers */
export function parseGeoFromHeaders(headers: Headers) {
  return {
    country: headers.get("x-vercel-ip-country") ?? headers.get("cf-ipcountry") ?? null,
    city: headers.get("x-vercel-ip-city") ?? null,
  };
}
