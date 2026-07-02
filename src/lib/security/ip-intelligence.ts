import type { Prisma } from "@prisma/client";

export type IpRiskInfo = {
  ipAddress: string;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  isHosting: boolean;
  provider: string | null;
  countryCode: string | null;
  countryName: string | null;
  asn: string | null;
  organization: string | null;
  source: string;
  checkedAt: string;
  raw: Prisma.InputJsonObject | null;
  error?: string;
};

const IPAPI_SOURCE = "ipapi.is";
const DEFAULT_BASE_URL = "https://api.ipapi.is";
const DEFAULT_TIMEOUT_MS = 1_200;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_SIZE = 2_000;
const riskCache = new Map<string, { expiresAt: number; value: IpRiskInfo }>();
type MutableJsonValue = string | number | boolean | null | MutableJsonValue[] | { [key: string]: MutableJsonValue };
type MutableJsonObject = { [key: string]: MutableJsonValue };

export async function checkVpnStatus(ipAddress: string): Promise<IpRiskInfo> {
  const normalized = normalizeIpAddress(ipAddress);
  if (!normalized || isNonPublicIp(normalized)) {
    return emptyRisk(ipAddress, "Private, local, or unavailable IP address was not checked.");
  }

  const cached = riskCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const url = buildIpApiUrl(normalized);
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`IP intelligence API returned HTTP ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const parsed = parseIpApiResponse(normalized, json);
    cacheRisk(normalized, parsed);
    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown IP intelligence error";
    console.warn(`[ip-intelligence] VPN check failed for ${normalized}: ${message}`);
    return emptyRisk(normalized, message);
  } finally {
    clearTimeout(timeout);
  }
}

export function toIpRiskDbFields(risk: IpRiskInfo): {
  vpnDetected: boolean;
  vpnProvider: string | null;
  ipAsn: string | null;
  ipCompany: string | null;
  ipRiskSource: string | null;
  ipRiskCheckedAt: Date | null;
  ipRisk: Prisma.InputJsonObject;
} {
  return {
    vpnDetected: risk.isVpn,
    vpnProvider: risk.provider,
    ipAsn: risk.asn,
    ipCompany: risk.organization,
    ipRiskSource: risk.source,
    ipRiskCheckedAt: new Date(risk.checkedAt),
    ipRisk: {
      ipAddress: risk.ipAddress,
      isVpn: risk.isVpn,
      isProxy: risk.isProxy,
      isTor: risk.isTor,
      isHosting: risk.isHosting,
      provider: risk.provider,
      countryCode: risk.countryCode,
      countryName: risk.countryName,
      asn: risk.asn,
      organization: risk.organization,
      source: risk.source,
      checkedAt: risk.checkedAt,
      error: risk.error ?? null,
      raw: risk.raw,
    },
  };
}

function buildIpApiUrl(ipAddress: string) {
  const base = process.env.IP_INTELLIGENCE_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(base);
  url.searchParams.set("q", ipAddress);

  const apiKey = process.env.IP_API_KEY?.trim();
  if (apiKey) {
    url.searchParams.set(process.env.IP_API_KEY_PARAM?.trim() || "key", apiKey);
  }

  return url;
}

function parseIpApiResponse(ipAddress: string, json: Record<string, unknown>): IpRiskInfo {
  const vpnObject = readObject(json.vpn);
  const proxyObject = readObject(json.proxy);
  const torObject = readObject(json.tor);
  const hostingObject = readObject(json.hosting);
  const locationObject = readObject(json.location);
  const asnObject = readObject(json.asn);
  const companyObject = readObject(json.company);
  const securityObject = readObject(json.security);

  const isVpn = readBoolean(json.is_vpn) || readBoolean(json.isVpn) || readBoolean(vpnObject?.is_vpn) || readBoolean(vpnObject?.isVpn) || readBoolean(securityObject?.vpn);
  const isProxy = readBoolean(json.is_proxy) || readBoolean(json.isProxy) || readBoolean(proxyObject?.is_proxy) || readBoolean(proxyObject?.isProxy) || readBoolean(securityObject?.proxy);
  const isTor = readBoolean(json.is_tor) || readBoolean(json.isTor) || readBoolean(torObject?.is_tor) || readBoolean(torObject?.isTor) || readBoolean(securityObject?.tor);
  const isHosting = readBoolean(json.is_hosting) || readBoolean(json.isHosting) || readBoolean(hostingObject?.is_hosting) || readBoolean(hostingObject?.isHosting) || readBoolean(securityObject?.hosting);

  const provider =
    readString(vpnObject?.name) ||
    readString(vpnObject?.provider) ||
    readString(vpnObject?.service) ||
    (isVpn ? readString(companyObject?.name) || readString(asnObject?.org) || "Unknown" : null);

  const asnNumber = readString(asnObject?.asn) || readString(json.asn) || null;
  const asnOrg = readString(asnObject?.org) || readString(asnObject?.name) || readString(asnObject?.organization);
  const company = readString(companyObject?.name) || asnOrg || null;

  return {
    ipAddress,
    isVpn,
    isProxy,
    isTor,
    isHosting,
    provider,
    countryCode: readString(locationObject?.country_code) || readString(json.country_code) || readString(json.countryCode),
    countryName: readString(locationObject?.country) || readString(json.country_name) || readString(json.countryName),
    asn: asnNumber ? (asnNumber.toUpperCase().startsWith("AS") ? asnNumber : `AS${asnNumber}`) : null,
    organization: company,
    source: IPAPI_SOURCE,
    checkedAt: new Date().toISOString(),
    raw: compactJson(json),
  };
}

function cacheRisk(ipAddress: string, value: IpRiskInfo) {
  if (riskCache.size >= MAX_CACHE_SIZE) {
    const first = riskCache.keys().next().value;
    if (first) riskCache.delete(first);
  }
  riskCache.set(ipAddress, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function emptyRisk(ipAddress: string, error?: string): IpRiskInfo {
  return {
    ipAddress,
    isVpn: false,
    isProxy: false,
    isTor: false,
    isHosting: false,
    provider: null,
    countryCode: null,
    countryName: null,
    asn: null,
    organization: null,
    source: IPAPI_SOURCE,
    checkedAt: new Date().toISOString(),
    raw: null,
    error,
  };
}

function timeoutMs() {
  const parsed = Number.parseInt(process.env.IP_INTELLIGENCE_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function normalizeIpAddress(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("[") && trimmed.includes("]")) return trimmed.slice(1, trimmed.indexOf("]"));
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) return trimmed.replace(/:\d+$/, "");
  return trimmed;
}

function isNonPublicIp(ipAddress: string) {
  const lower = ipAddress.toLowerCase();
  if (lower === "localhost" || lower === "::1" || lower === "127.0.0.1") return true;
  if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd")) return true;

  const parts = lower.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function readBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return ["true", "1", "yes"].includes(value.toLowerCase());
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return readBoolean(object.is_vpn) || readBoolean(object.is_proxy) || readBoolean(object.is_tor) || readBoolean(object.detected);
  }
  return false;
}

function readString(value: unknown) {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function compactJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  const compact: MutableJsonObject = {};
  for (const [key, item] of Object.entries(value).slice(0, 40)) {
    if (item === null) compact[key] = null;
    else if (typeof item === "string") compact[key] = item.slice(0, 500);
    else if (typeof item === "number" || typeof item === "boolean") compact[key] = item;
    else if (Array.isArray(item)) compact[key] = item.slice(0, 10).filter(isJsonPrimitive);
    else if (typeof item === "object") compact[key] = compactNestedObject(item as Record<string, unknown>);
  }
  return compact as Prisma.InputJsonObject;
}

function compactNestedObject(value: Record<string, unknown>): MutableJsonObject {
  const compact: MutableJsonObject = {};
  for (const [key, item] of Object.entries(value).slice(0, 20)) {
    if (item === null) compact[key] = null;
    else if (typeof item === "string") compact[key] = item.slice(0, 300);
    else if (typeof item === "number" || typeof item === "boolean") compact[key] = item;
  }
  return compact;
}

function isJsonPrimitive(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
