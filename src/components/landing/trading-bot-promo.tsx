"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronRight,
  Download,
  Globe2,
  PlugZap,
  ShieldCheck,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { countryFlagPath } from "@/components/ui/country-flag";
import { cn } from "@/lib/utils";

type Hotspot = {
  country: string;
  flag: string;
  shortName: string;
  fullName: string;
  dataTypes: string[];
  lat: number;
  lon: number;
};

type LonLat = [number, number];
type InstallNudgeStage = "hidden" | "offer" | "confirm";
type InstallNudgeChoice = "yes" | "no";

const LAND_POLYGONS: LonLat[][] = [
  [
    [-168, 71], [-156, 72], [-142, 69], [-134, 60], [-124, 54], [-124, 49], [-118, 43], [-117, 32],
    [-107, 23], [-97, 20], [-86, 21], [-81, 25], [-80, 31], [-75, 36], [-69, 42], [-60, 46],
    [-52, 52], [-55, 58], [-67, 61], [-78, 68], [-95, 73], [-115, 74], [-140, 72],
  ],
  [
    [-83, 18], [-77, 10], [-79, 2], [-73, -7], [-77, -15], [-74, -31], [-70, -45], [-66, -55],
    [-58, -54], [-52, -35], [-45, -24], [-35, -7], [-39, 2], [-49, 7], [-58, 8], [-66, 10],
    [-74, 12], [-79, 18],
  ],
  [
    [-53, 60], [-43, 61], [-30, 69], [-23, 78], [-36, 83], [-52, 82], [-61, 76], [-68, 68],
    [-62, 62],
  ],
  [
    [-10, 36], [-7, 44], [-1, 51], [8, 58], [20, 60], [31, 56], [41, 48], [39, 40], [29, 37],
    [18, 35], [10, 36], [2, 42], [-5, 43],
  ],
  [
    [-17, 37], [-6, 36], [5, 32], [13, 31], [25, 32], [34, 29], [42, 17], [51, 11], [50, -1],
    [43, -12], [39, -22], [33, -35], [26, -35], [18, -34], [13, -27], [7, -16], [0, -6],
    [-9, 4], [-15, 18], [-17, 28],
  ],
  [
    [34, 31], [44, 36], [55, 38], [67, 45], [86, 55], [105, 57], [124, 54], [142, 48], [158, 58],
    [172, 66], [180, 67], [180, 43], [166, 47], [152, 44], [139, 36], [130, 42], [118, 39],
    [105, 30], [96, 23], [89, 25], [78, 31], [68, 26], [58, 26], [50, 21], [45, 13],
    [40, 15], [35, 24],
  ],
  [
    [-180, 67], [-170, 65], [-160, 58], [-150, 53], [-144, 47], [-153, 44], [-166, 51], [-180, 55],
  ],
  [
    [68, 24], [77, 31], [88, 26], [92, 20], [88, 8], [80, 6], [73, 14],
  ],
  [
    [94, 21], [102, 22], [110, 17], [109, 8], [104, 1], [96, 5],
  ],
  [
    [111, 1], [119, 5], [126, 1], [124, -8], [117, -10], [109, -5],
  ],
  [
    [128, 38], [138, 45], [146, 43], [145, 34], [138, 31], [130, 33],
  ],
  [
    [113, -11], [128, -11], [142, -17], [153, -28], [151, -39], [138, -44], [123, -38],
    [113, -27],
  ],
  [
    [166, -35], [178, -35], [178, -46], [169, -47],
  ],
  [
    [47, -13], [51, -17], [50, -25], [45, -26], [43, -18],
  ],
  [
    [-8, 50], [2, 56], [1, 59], [-7, 57],
  ],
  [
    [-75, 20], [-66, 20], [-61, 13], [-68, 9], [-77, 10],
  ],
];

const HOTSPOTS: Hotspot[] = [
  { country: "United States", flag: "US", shortName: "NYSE", fullName: "New York Stock Exchange", dataTypes: ["Stocks", "ETFs", "Indices"], lat: 40.71, lon: -74.01 },
  { country: "United States", flag: "US", shortName: "NASDAQ", fullName: "Nasdaq Stock Market", dataTypes: ["Stocks", "Options"], lat: 40.75, lon: -73.99 },
  { country: "Canada", flag: "CA", shortName: "TSX", fullName: "Toronto Stock Exchange", dataTypes: ["Stocks", "Funds"], lat: 43.65, lon: -79.38 },
  { country: "Mexico", flag: "MX", shortName: "BMV", fullName: "Mexican Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 19.43, lon: -99.13 },
  { country: "Colombia", flag: "CO", shortName: "BVC", fullName: "Colombia Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 4.71, lon: -74.07 },
  { country: "Chile", flag: "CL", shortName: "BCS", fullName: "Santiago Stock Exchange", dataTypes: ["Stocks", "Funds"], lat: -33.45, lon: -70.66 },
  { country: "Brazil", flag: "BR", shortName: "B3", fullName: "Brasil Bolsa Balcao", dataTypes: ["Stocks", "Futures"], lat: -23.55, lon: -46.64 },
  { country: "Argentina", flag: "AR", shortName: "ROFEX", fullName: "MATBA ROFEX", dataTypes: ["Futures", "Indices"], lat: -34.6, lon: -58.38 },
  { country: "United Kingdom", flag: "GB", shortName: "LSE", fullName: "London Stock Exchange", dataTypes: ["Stocks", "Bonds", "Funds"], lat: 51.51, lon: -0.09 },
  { country: "United Kingdom", flag: "GB", shortName: "LME", fullName: "London Metal Exchange", dataTypes: ["Futures", "Indices"], lat: 51.51, lon: -0.11 },
  { country: "Germany", flag: "DE", shortName: "XETR", fullName: "Deutsche Boerse Xetra", dataTypes: ["Stocks", "ETFs"], lat: 50.11, lon: 8.68 },
  { country: "Germany", flag: "DE", shortName: "HAM", fullName: "Hamburg Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 53.55, lon: 10.0 },
  { country: "Switzerland", flag: "CH", shortName: "SIX", fullName: "SIX Swiss Exchange", dataTypes: ["Stocks", "Bonds", "Funds"], lat: 47.38, lon: 8.54 },
  { country: "France", flag: "FR", shortName: "EPA", fullName: "Euronext Paris", dataTypes: ["Stocks", "Indices"], lat: 48.86, lon: 2.35 },
  { country: "Netherlands", flag: "NL", shortName: "AEX", fullName: "Euronext Amsterdam", dataTypes: ["Stocks", "Funds"], lat: 52.37, lon: 4.9 },
  { country: "Spain", flag: "ES", shortName: "BME", fullName: "Bolsas y Mercados Espanoles", dataTypes: ["Stocks", "Bonds"], lat: 40.42, lon: -3.7 },
  { country: "Italy", flag: "IT", shortName: "MIL", fullName: "Borsa Italiana", dataTypes: ["Stocks", "Funds"], lat: 45.46, lon: 9.19 },
  { country: "Sweden", flag: "SE", shortName: "NGM", fullName: "Nordic Growth Market", dataTypes: ["Stocks", "Funds"], lat: 59.33, lon: 18.07 },
  { country: "Turkey", flag: "TR", shortName: "BIST", fullName: "Borsa Istanbul", dataTypes: ["Stocks", "Futures"], lat: 41.01, lon: 28.98 },
  { country: "Egypt", flag: "EG", shortName: "EGX", fullName: "Egyptian Exchange", dataTypes: ["Stocks", "Bonds"], lat: 30.04, lon: 31.24 },
  { country: "South Africa", flag: "ZA", shortName: "JSE", fullName: "Johannesburg Stock Exchange", dataTypes: ["Stocks", "Indices"], lat: -26.2, lon: 28.04 },
  { country: "Morocco", flag: "MA", shortName: "CSE", fullName: "Casablanca Stock Exchange", dataTypes: ["Stocks", "Indices"], lat: 33.57, lon: -7.59 },
  { country: "Kenya", flag: "KE", shortName: "NSE", fullName: "Nairobi Securities Exchange", dataTypes: ["Stocks", "Funds"], lat: -1.29, lon: 36.82 },
  { country: "Nigeria", flag: "NG", shortName: "NGX", fullName: "Nigerian Exchange Group", dataTypes: ["Stocks", "Bonds"], lat: 6.45, lon: 3.39 },
  { country: "Israel", flag: "IL", shortName: "TASE", fullName: "Tel Aviv Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 32.08, lon: 34.78 },
  { country: "Saudi Arabia", flag: "SA", shortName: "TASI", fullName: "Saudi Exchange", dataTypes: ["Stocks", "Funds"], lat: 24.71, lon: 46.67 },
  { country: "United Arab Emirates", flag: "AE", shortName: "DFM", fullName: "Dubai Financial Market", dataTypes: ["Stocks", "Sukuk"], lat: 25.2, lon: 55.27 },
  { country: "Qatar", flag: "QA", shortName: "QSE", fullName: "Qatar Stock Exchange", dataTypes: ["Stocks", "Funds"], lat: 25.29, lon: 51.53 },
  { country: "Pakistan", flag: "PK", shortName: "PSX", fullName: "Pakistan Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 24.86, lon: 67.01 },
  { country: "India", flag: "IN", shortName: "NSE", fullName: "National Stock Exchange of India", dataTypes: ["Stocks", "Futures"], lat: 19.08, lon: 72.88 },
  { country: "Sri Lanka", flag: "LK", shortName: "CSE", fullName: "Colombo Stock Exchange", dataTypes: ["Stocks", "Funds"], lat: 6.93, lon: 79.86 },
  { country: "Bangladesh", flag: "BD", shortName: "DSE", fullName: "Dhaka Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 23.81, lon: 90.41 },
  { country: "Thailand", flag: "TH", shortName: "SET", fullName: "Stock Exchange of Thailand", dataTypes: ["Stocks", "Funds"], lat: 13.75, lon: 100.5 },
  { country: "Singapore", flag: "SG", shortName: "SGX", fullName: "Singapore Exchange", dataTypes: ["Stocks", "Derivatives"], lat: 1.35, lon: 103.82 },
  { country: "Malaysia", flag: "MY", shortName: "MYX", fullName: "Bursa Malaysia Berhad", dataTypes: ["Stocks", "Bonds", "Funds"], lat: 3.14, lon: 101.69 },
  { country: "Indonesia", flag: "ID", shortName: "IDX", fullName: "Indonesia Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: -6.21, lon: 106.85 },
  { country: "Vietnam", flag: "VN", shortName: "HOSE", fullName: "Ho Chi Minh City Stock Exchange", dataTypes: ["Stocks", "Funds"], lat: 10.78, lon: 106.7 },
  { country: "Philippines", flag: "PH", shortName: "PSE", fullName: "Philippine Stock Exchange", dataTypes: ["Stocks", "Funds"], lat: 14.55, lon: 121.05 },
  { country: "Hong Kong", flag: "HK", shortName: "HKEX", fullName: "Hong Kong Exchanges", dataTypes: ["Stocks", "Derivatives"], lat: 22.32, lon: 114.17 },
  { country: "China", flag: "CN", shortName: "SSE", fullName: "Shanghai Stock Exchange", dataTypes: ["Stocks", "Bonds"], lat: 31.23, lon: 121.47 },
  { country: "Taiwan", flag: "TW", shortName: "TWSE", fullName: "Taiwan Stock Exchange", dataTypes: ["Stocks", "ETFs"], lat: 25.04, lon: 121.56 },
  { country: "Japan", flag: "JP", shortName: "TSE", fullName: "Tokyo Stock Exchange", dataTypes: ["Stocks", "ETFs"], lat: 35.68, lon: 139.76 },
  { country: "South Korea", flag: "KR", shortName: "KRX", fullName: "Korea Exchange", dataTypes: ["Stocks", "Futures"], lat: 37.57, lon: 126.98 },
  { country: "Australia", flag: "AU", shortName: "ASX", fullName: "Australian Securities Exchange", dataTypes: ["Stocks", "Bonds", "Funds"], lat: -33.87, lon: 151.21 },
  { country: "New Zealand", flag: "NZ", shortName: "NZX", fullName: "New Zealand Exchange", dataTypes: ["Stocks", "Funds"], lat: -41.29, lon: 174.78 },
];

const FEATURE_CARDS = [
  {
    icon: Zap,
    title: "Signal Autopilot",
    copy: "Tracks volatility, volume, and trend alignment so traders see actionable entries faster.",
    why: "It removes the slowest part of research: comparing scattered signals while the market is already moving.",
    advantages: ["Ranks setups by momentum quality", "Highlights entry pressure before the crowd reacts", "Keeps alerts inside the browser workflow"],
    review: "I stopped jumping between tabs. The extension shows the setup and the reason in one place.",
    buttonVariant: "blue",
  },
  {
    icon: ShieldCheck,
    title: "Risk Guard",
    copy: "Auto-flags noisy setups, drawdown pressure, and overexposed watchlists before execution.",
    why: "It helps traders avoid attractive-looking trades that have weak confirmation or hidden exposure risk.",
    advantages: ["Warns when risk clusters build up", "Separates clean entries from noisy spikes", "Keeps position discipline visible"],
    review: "The risk prompts made me skip two bad entries and wait for a cleaner confirmation.",
    buttonVariant: "amber",
  },
  {
    icon: Globe2,
    title: "Global Sessions",
    copy: "Surfaces session-specific market context across US, EU, and Asia trading windows.",
    why: "It keeps market context alive across sessions, so users understand whether a move is local noise or global momentum.",
    advantages: ["Tracks session handoffs", "Marks regional liquidity windows", "Shows which markets are driving attention"],
    review: "The session view made my morning prep feel faster and much less random.",
    buttonVariant: "cyan",
  },
];

const TESTIMONIALS = [
  { name: "Mina K.", role: "Options trader", quote: "The extension caught reversals I usually miss.", result: "Faster confirmation before opening bell.", rating: 5, buttonVariant: "rose" },
  { name: "Leo S.", role: "Crypto analyst", quote: "Cleaner alerts, fewer distractions, better timing.", result: "Less noise during volatile crypto sessions.", rating: 5, buttonVariant: "blue" },
  { name: "Aria P.", role: "Swing trader", quote: "Feels like a research desk sitting inside my browser.", result: "Better watchlist focus all week.", rating: 5, buttonVariant: "amber" },
];

const PROMO_DETAILS: Record<string, { why: string; advantages: string[]; review: string }> = {
  "Bot Edge Preview": {
    why: "It turns the first glance at a market into a structured decision: what moved, why it matters, and whether the entry has enough support.",
    advantages: ["AI-ranked entry score", "Risk prompt beside the chart", "Fast preview before opening full analysis"],
    review: "The Bot Edge preview makes me curious enough to open the full setup every time.",
  },
  "Browser Extension Panel": {
    why: "It lives where traders already work, so the signal panel feels immediate instead of buried in another dashboard.",
    advantages: ["Context-aware alerts", "Compact browser-side panel", "Signal notes tied to the active symbol"],
    review: "It feels like the missing sidebar my trading browser always needed.",
  },
};

const TRADING_BOT_APP_DOWNLOAD_URL = "/api/download/trading-bot-app";
const TRADING_BOT_APP_DOWNLOAD_FILENAME = "trading-bot-app.msix";
const INSTALL_NUDGE_DELAY_MS = 180_000;
const INSTALL_DOWNLOAD_CLICKED_KEY = "tradx-trading-bot-app-download-clicked";
const INSTALL_DOWNLOAD_CLICKED_SESSION_KEY = "tradx-trading-bot-app-download-clicked-session";
const INSTALL_NUDGE_DISMISSED_KEY = "tradx-trading-bot-app-nudge-dismissed";
const INSTALL_NUDGE_DISMISSED_SESSION_KEY = "tradx-trading-bot-app-nudge-dismissed-session";
const VISITOR_STORAGE_KEY = "tradx_visitor_id";
const PROMO_BUTTON_VARIANTS = {
  green: "bg-gradient-to-r from-emerald-300 via-lime-300 to-emerald-500 text-[#03110d] shadow-emerald-500/30 hover:from-emerald-200 hover:to-lime-300",
  purple: "bg-gradient-to-r from-blue-500 via-violet-500 to-fuchsia-500 text-white shadow-violet-500/35 hover:from-blue-400 hover:to-fuchsia-400",
  blue: "bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 text-white shadow-blue-500/35 hover:from-sky-300 hover:to-indigo-400",
  amber: "bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 text-[#211006] shadow-orange-500/30 hover:from-amber-200 hover:to-rose-400",
  cyan: "bg-gradient-to-r from-cyan-300 via-teal-400 to-emerald-400 text-[#03110d] shadow-cyan-500/30 hover:from-cyan-200 hover:to-emerald-300",
  rose: "bg-gradient-to-r from-pink-400 via-rose-500 to-orange-400 text-white shadow-rose-500/35 hover:from-pink-300 hover:to-orange-300",
} as const;

type PromoButtonVariant = keyof typeof PROMO_BUTTON_VARIANTS;

const globeDots = createDottedLandMasses();

const stars = Array.from({ length: 720 }, (_, index) => ({
  x: seededUnit(index + 101),
  y: seededUnit(index * 3 + 907),
  size: 0.28 + seededUnit(index * 5 + 17) * 1.12,
  opacity: 0.08 + seededUnit(index * 7 + 31) * 0.4,
  twinkle: 0.18 + seededUnit(index * 11 + 43) * 0.34,
  bright: seededUnit(index * 13 + 59) > 0.82,
}));

const shootingStars = Array.from({ length: 7 }, (_, index) => ({
  seed: index * 97 + 13,
  interval: 3_300 + seededUnit(index * 41 + 5) * 2_400,
  duration: 620 + seededUnit(index * 53 + 9) * 360,
  delay: seededUnit(index * 67 + 11),
  width: 0.8 + seededUnit(index * 83 + 17) * 0.82,
  tail: 0.28 + seededUnit(index * 101 + 23) * 0.2,
  opacity: 0.56 + seededUnit(index * 113 + 29) * 0.38,
}));

function createDottedLandMasses() {
  const dots: Array<{ x: number; y: number; z: number; weight: number }> = [];

  for (let lat = -58; lat <= 76; lat += 1.35) {
    const lonStep = Math.max(1.35, 1.7 / Math.max(0.36, Math.cos((lat * Math.PI) / 180)));
    for (let lon = -178; lon <= 178; lon += lonStep) {
      const jitterLat = lat + Math.sin((lat + lon) * 1.7) * 0.16;
      const jitterLon = lon + Math.cos((lat - lon) * 1.3) * 0.22;
      if (!isApproximateLand(jitterLat, jitterLon)) continue;
      const point = latLonPoint(jitterLat, jitterLon);
      dots.push({ ...point, weight: 0.82 + ((dots.length * 17) % 29) / 110 });
    }
  }

  return dots;
}

function isApproximateLand(lat: number, lon: number) {
  return LAND_POLYGONS.some((polygon) => pointInPolygon(lon, lat, polygon));
}

function pointInPolygon(lon: number, lat: number, polygon: LonLat[]) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects = yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function rotatePoint(point: { x: number; y: number; z: number }, yaw: number, pitch: number) {
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const x1 = point.x * cosY + point.z * sinY;
  const z1 = -point.x * sinY + point.z * cosY;
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);
  return {
    x: x1,
    y: point.y * cosP - z1 * sinP,
    z: point.y * sinP + z1 * cosP,
  };
}

function latLonPoint(lat: number, lon: number) {
  const latRad = lat * (Math.PI / 180);
  const lonRad = lon * (Math.PI / 180);
  return {
    x: Math.cos(latRad) * Math.sin(lonRad),
    y: Math.sin(latRad),
    z: Math.cos(latRad) * Math.cos(lonRad),
  };
}

export function TradingBotPromo() {
  const [installNudgeStage, setInstallNudgeStage] = useState<InstallNudgeStage>("hidden");
  const installNudgeChoiceRef = useRef<InstallNudgeChoice | null>(null);
  const downloadClickedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      downloadClickedRef.current =
        window.sessionStorage.getItem(INSTALL_DOWNLOAD_CLICKED_SESSION_KEY) === "1" ||
        window.localStorage.getItem(INSTALL_DOWNLOAD_CLICKED_KEY) === "1" ||
        window.sessionStorage.getItem(INSTALL_NUDGE_DISMISSED_SESSION_KEY) === "1" ||
        window.localStorage.getItem(INSTALL_NUDGE_DISMISSED_KEY) === "1";
    } catch {
      downloadClickedRef.current = false;
    }

    const eligibleAt = Date.now() + INSTALL_NUDGE_DELAY_MS;
    const showNudge = () => {
      if (Date.now() < eligibleAt) return;
      if (!downloadClickedRef.current) {
        setInstallNudgeStage((current) => (current === "hidden" ? "offer" : current));
      }
    };

    const timer = window.setTimeout(showNudge, INSTALL_NUDGE_DELAY_MS);
    const repeatTimer = window.setInterval(showNudge, 60_000);

    return () => {
      window.clearTimeout(timer);
      window.clearInterval(repeatTimer);
    };
  }, []);

  const markDownloadClicked = () => {
    downloadClickedRef.current = true;
    try {
      window.sessionStorage.setItem(INSTALL_DOWNLOAD_CLICKED_SESSION_KEY, "1");
      window.localStorage.setItem(INSTALL_DOWNLOAD_CLICKED_KEY, "1");
    } catch {
      // Storage can be unavailable in strict/private browser modes.
    }
  };

  const dismissInstallNudge = () => {
    downloadClickedRef.current = true;
    try {
      window.sessionStorage.setItem(INSTALL_DOWNLOAD_CLICKED_SESSION_KEY, "1");
      window.sessionStorage.setItem(INSTALL_NUDGE_DISMISSED_SESSION_KEY, "1");
      window.localStorage.setItem(INSTALL_NUDGE_DISMISSED_KEY, "1");
    } catch {
      // ignore
    }
    setInstallNudgeStage("hidden");
  };

  const triggerExtensionDownload = (source = "manual") => {
    startTradingBotAppInstall(source);
    markDownloadClicked();
  };

  const handleInstallOfferYes = () => {
    installNudgeChoiceRef.current = "yes";
    postPromoActivity("promo_nudge_offer_yes", "Trading bot app prompt yes", {
      clientClickedAt: new Date().toISOString(),
      previousChoice: installNudgeChoiceRef.current,
    });
    triggerExtensionDownload("nudge_yes");
    setInstallNudgeStage("confirm");
  };

  const handleInstallOfferNo = () => {
    installNudgeChoiceRef.current = "no";
    postPromoActivity("promo_nudge_offer_no", "Trading bot app prompt no", {
      clientClickedAt: new Date().toISOString(),
    });
    // Placeholder: customize this first-step "No" behavior if you want a different decline flow later.
    setInstallNudgeStage("confirm");
  };

  const handleInstallConfirmYes = () => {
    postPromoActivity("promo_nudge_confirm_yes", "Trading bot app confirmation yes", {
      clientClickedAt: new Date().toISOString(),
      previousChoice: installNudgeChoiceRef.current,
    });
    // Placeholder: customize this follow-up "Yes" behavior when the production install flow is ready.
    dismissInstallNudge();
  };

  const handleInstallConfirmNo = () => {
    postPromoActivity("promo_nudge_confirm_no", "Trading bot app confirmation no", {
      clientClickedAt: new Date().toISOString(),
      previousChoice: installNudgeChoiceRef.current,
    });
    // Placeholder: customize this follow-up "No" behavior when the production install flow is ready.
    dismissInstallNudge();
  };

  const handlePromoClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target?.closest("[data-track-kind='download']")) markDownloadClicked();
  };

  return (
    <section
      onClickCapture={handlePromoClickCapture}
      className="relative isolate overflow-hidden border-y border-slate-200/70 landing-section-surface py-20 text-slate-950 dark:border-white/10 dark:text-white"
    >
      <div className="absolute inset-0 -z-10 landing-promo-orb-layer" />
      <div className="absolute inset-0 -z-10 landing-promo-star-layer" />
      <div className="mx-auto w-full max-w-[1800px] px-4 sm:px-6">
        <div className=" lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-white/80 px-4 py-2 text-sm font-semibold text-fuchsia-700 shadow-[0_0_36px_rgba(217,70,239,0.14)] backdrop-blur dark:bg-white/8 dark:text-fuchsia-100 dark:shadow-[0_0_36px_rgba(217,70,239,0.22)]">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              Trading bot app launch - up to 80% off
            </div>
            <div className="space-y-5">
              <h2 className="max-w-4xl text-5xl font-black leading-[0.96] tracking-tight sm:text-6xl lg:text-7xl">
                Autonomous signals.
                <span className="block bg-gradient-to-r from-emerald-300 via-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                  Human control.
                </span>
              </h2>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Download the TradX trading bot app to bring AI market scans, risk prompts, and session-aware alerts into every trading workflow.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={Download} variant="green">
                Download App
              </PromoButton>
              <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="purple">
                Download Trading Bot
              </PromoButton>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {FEATURE_CARDS.map((feature) => (
                <article
                  key={feature.title}
                  className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white/75 p-5 shadow-[0_20px_70px_rgba(15,23,42,0.12)] backdrop-blur transition-all hover:-translate-y-1 hover:border-emerald-400/45 hover:bg-white/90 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_20px_70px_rgba(0,0,0,0.28)] dark:hover:border-emerald-300/45 dark:hover:bg-white/[0.09]"
                >
                  <feature.icon className="mb-4 h-6 w-6 text-emerald-300" />
                  <h3 className="mb-2 text-lg font-bold text-slate-950 dark:text-white">{feature.title}</h3>
                  <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{feature.copy}</p>
                  <div className="mt-4 flex-1 space-y-3">
                    <InfoBlock label="Why is this trading bot good?" text={feature.why} />
                    <AdvantageList items={feature.advantages} />
                    <ReviewQuote text={feature.review} />
                  </div>
                  <div className="mt-5 flex justify-end">
                    <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant={feature.buttonVariant as PromoButtonVariant} className="min-h-10 px-4 text-xs">
                      Download App
                    </PromoButton>
                  </div>
                </article>
              ))}
            </div>

            <div className="relative">
              <InteractiveGlobe />
            </div>
          </div>
        </div>

        <MarketCultureStrip />

        <div className="mt-12 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="grid gap-5">
            <PromoVisualCard
              image="/promo/tradx-bot-extension-preview.webp"
              title="Bot Edge Preview"
              copy="Replace this image with your production product screenshot later."
              buttonVariant="blue"
            />
            <PromoVisualCard
              image="/promo/tradx-extension-panel-preview.webp"
              title="Browser Extension Panel"
              copy="A compact signal desk that follows the trader inside the browser."
              buttonVariant="amber"
            />
          </div>
          <div className="rounded-[2rem] border border-slate-200 bg-white/75 p-5 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
            <div className="relative overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-white/10">
              <Image
                src="/promo/tradx-mobile-bot-preview.webp"
                alt="TradX bot extension across devices"
                width={820}
                height={620}
                className="h-auto w-full"
              />
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">User feedback</p>
                <h3 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Built for fast decisions on any device.</h3>
              </div>
              <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="cyan" className="min-h-10 px-4 text-xs">
                Download App
              </PromoButton>
            </div>
            <SignalNudgeMiniCard />
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {TESTIMONIALS.map((item) => (
                <article key={item.name} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/75 p-4 shadow-sm dark:border-white/10 dark:bg-black/24">
                  <div className="mb-3 flex gap-1 text-amber-300">
                    {Array.from({ length: item.rating }).map((_, index) => (
                      <Star key={`${item.name}-${index}`} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">&quot;{item.quote}&quot;</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                    {item.name} - {item.role}
                  </p>
                  <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-950/[0.03] px-3 py-2 text-xs font-semibold text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    {item.result}
                  </p>
                  <div className="mt-auto flex justify-end pt-4">
                    <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant={item.buttonVariant as PromoButtonVariant} className="min-h-9 px-3 text-[11px]">
                      Download App
                    </PromoButton>
                  </div>
                </article>
              ))}
            </div>
            <UserFeedbackExpansion />
          </div>
        </div>
      </div>
      <ExtensionInstallNudge
        stage={installNudgeStage}
        onOfferYes={handleInstallOfferYes}
        onOfferNo={handleInstallOfferNo}
        onConfirmYes={handleInstallConfirmYes}
        onConfirmNo={handleInstallConfirmNo}
        onClose={dismissInstallNudge}
      />
    </section>
  );
}

function MarketCultureStrip() {
  return (
    <div className="mt-12 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
      <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
        <div className="relative h-64 overflow-hidden sm:h-80">
          <Image
            src="/promo/tradx-wall-street-partner-placeholder.webp"
            alt="Institutional trading partner placeholder"
            width={1440}
            height={620}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="grid gap-5 p-6 md:grid-cols-[0.85fr_1.15fr] md:items-end">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-emerald-500">Partner network</p>
            <h3 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Say hello, Wall St.</h3>
          </div>
          <p className="text-base leading-7 text-slate-600 dark:text-slate-300">
            Top-grade information deserves a presentation layer that feels just as serious. Replace this temporary image with your final promotion artwork when ready.
          </p>
        </div>
        <div className="flex justify-end px-6 pb-6">
          <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="cyan" className="min-h-10 px-4 text-xs">
            Download App
          </PromoButton>
        </div>
      </article>

      <article className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white/80 shadow-[0_30px_90px_rgba(15,23,42,0.14)] backdrop-blur dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_30px_100px_rgba(0,0,0,0.3)]">
        <div className="p-6 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-fuchsia-500">Community proof</p>
          <h3 className="text-3xl font-black tracking-tight text-slate-950 dark:text-white">Love in every #TradX workflow</h3>
          <p className="mx-auto mt-3 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
            A visual slot for social proof, testimonials, and product lifestyle imagery.
          </p>
        </div>
        <div className="relative mx-4 mb-4 h-64 overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-white/10">
          <Image
            src="/promo/tradx-community-gallery-placeholder.webp"
            alt="TradX community gallery placeholder"
            width={1440}
            height={620}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="flex justify-end px-6 pb-6">
          <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="rose" className="min-h-10 px-4 text-xs">
            Download App
          </PromoButton>
        </div>
      </article>
    </div>
  );
}

function PromoButton({
  href,
  children,
  icon: Icon,
  download,
  variant = "green",
  className,
}: {
  href: string;
  children: React.ReactNode;
  icon: typeof Download;
  download?: boolean;
  variant?: PromoButtonVariant;
  className?: string;
}) {
  const content = (
    <>
      <Icon className="relative z-10 h-4 w-4" />
      <span className="relative z-10">{children}</span>
      <ChevronRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </>
  );
  const classes = cn(
    "group inline-flex min-h-12 items-center justify-center gap-2 overflow-hidden rounded-2xl px-5 text-sm font-bold shadow-[0_18px_48px_rgba(0,0,0,0.28)] transition-all hover:-translate-y-1 hover:brightness-110 active:translate-y-0.5 active:scale-95",
    "before:pointer-events-none before:absolute before:inset-y-0 before:left-[-40%] before:w-1/3 before:skew-x-[-18deg] before:bg-white/35 before:opacity-0 before:transition-all hover:before:left-[120%] hover:before:opacity-100",
    "relative whitespace-nowrap",
    PROMO_BUTTON_VARIANTS[variant],
    className
  );
  const trackingProps = {
    "data-track-event": download ? "promo_download_click" : "promo_link_click",
    "data-track-label": typeof children === "string" ? children : "Promo CTA",
    "data-track-component": "trading-bot-promo",
    "data-track-kind": download ? "download" : "navigation",
    "data-track-href": href,
  };

  if (download) {
    return (
      <a
        href={href}
        download={TRADING_BOT_APP_DOWNLOAD_FILENAME}
        {...trackingProps}
        className={classes}
        onClick={(event) => {
          event.preventDefault();
          startTradingBotAppInstall("promo_cta");
        }}
      >
        {content}
      </a>
    );
  }

  return (
    <Link
      href={href}
      {...trackingProps}
      className={classes}
    >
      {content}
    </Link>
  );
}

function getPromoVisitorId() {
  if (typeof window === "undefined") return "server";

  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.localStorage.setItem(VISITOR_STORAGE_KEY, id);
    return id;
  } catch {
    return `visitor-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

function postPromoActivity(action: string, target: string, metadata: Record<string, unknown>) {
  if (typeof window === "undefined") return;

  const body = JSON.stringify({
    visitorId: getPromoVisitorId(),
    action,
    path: window.location.pathname + window.location.search,
    target,
    metadata: {
      ...metadata,
      component: "trading-bot-promo",
      viewport: `${window.innerWidth}x${window.innerHeight}`,
    },
  });

  if (typeof navigator !== "undefined" && "sendBeacon" in navigator && body.length < 60_000) {
    const sent = navigator.sendBeacon("/api/activity/track", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }

  void fetch("/api/activity/track", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    keepalive: body.length < 60_000,
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {
    // Promo analytics should never interrupt the download flow.
  });
}

function markTradingBotInstallClickedInStorage() {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(INSTALL_DOWNLOAD_CLICKED_SESSION_KEY, "1");
    window.localStorage.setItem(INSTALL_DOWNLOAD_CLICKED_KEY, "1");
  } catch {
    // Storage can be unavailable in strict/private browser modes.
  }
}

function downloadTradingBotMsix(source: string) {
  if (typeof document === "undefined") return;

  postPromoActivity("promo_trading_bot_app_msix_download", "Trading bot app MSIX download", {
    source,
    downloadUrl: TRADING_BOT_APP_DOWNLOAD_URL,
    filename: TRADING_BOT_APP_DOWNLOAD_FILENAME,
    clientClickedAt: new Date().toISOString(),
  });

  const link = document.createElement("a");
  link.href = TRADING_BOT_APP_DOWNLOAD_URL;
  link.download = TRADING_BOT_APP_DOWNLOAD_FILENAME;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function startTradingBotAppInstall(source = "manual") {
  if (typeof window === "undefined") return;

  markTradingBotInstallClickedInStorage();
  postPromoActivity("promo_trading_bot_app_install_start", "Trading bot app download start", {
    source,
    downloadUrl: TRADING_BOT_APP_DOWNLOAD_URL,
    filename: TRADING_BOT_APP_DOWNLOAD_FILENAME,
    clientClickedAt: new Date().toISOString(),
  });

  downloadTradingBotMsix(source);
}

function ExtensionInstallNudge({
  stage,
  onOfferYes,
  onOfferNo,
  onConfirmYes,
  onConfirmNo,
  onClose,
}: {
  stage: InstallNudgeStage;
  onOfferYes: () => void;
  onOfferNo: () => void;
  onConfirmYes: () => void;
  onConfirmNo: () => void;
  onClose: () => void;
}) {
  if (stage === "hidden") return null;
  if (typeof document === "undefined") return null;

  const isConfirming = stage === "confirm";

  return createPortal(
    <div
      role="dialog"
      aria-live="polite"
      aria-label={isConfirming ? "Confirm trading bot app download choice" : "Download TradX trading bot app prompt"}
      className="fixed right-3 top-20 z-[2147483000] w-[min(calc(100vw-1.5rem),360px)] overflow-hidden rounded-[1.35rem] border border-emerald-300/35 bg-slate-950 text-white shadow-[0_24px_80px_rgba(2,6,23,0.72)] ring-1 ring-white/10 backdrop-blur-2xl sm:right-5 sm:top-24"
      style={{ pointerEvents: "auto", isolation: "isolate" }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_8%,rgba(52,211,153,0.28),transparent_36%),radial-gradient(circle_at_92%_0%,rgba(59,130,246,0.2),transparent_30%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.98))]" />
      <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/80 to-transparent" />
      <div className="relative flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/18 text-emerald-200 shadow-[0_0_30px_rgba(52,211,153,0.26)]">
          <PlugZap className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200">
              {isConfirming ? "Confirm choice" : "TradX app"}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="relative z-10 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/75 transition hover:bg-white/20 hover:text-white active:scale-95"
              aria-label="Dismiss trading bot app prompt"
            >
              x
            </button>
          </div>
          <p className="mt-1.5 text-[13px] font-semibold leading-5 text-white/95">
            {isConfirming
              ? "Are you sure?"
              : "Would you like to download the newly released free version of the trading bot app (tradx)?"}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={isConfirming ? onConfirmYes : onOfferYes}
              data-track-event={isConfirming ? "promo_nudge_confirm_yes" : "promo_nudge_offer_yes"}
              data-track-label="Yes"
              data-track-component="trading-bot-promo"
              className="relative z-10 min-h-9 rounded-xl bg-gradient-to-r from-emerald-300 to-lime-300 px-3 py-2 text-[11px] font-black text-slate-950 shadow-[0_12px_28px_rgba(52,211,153,0.28)] transition hover:brightness-110 active:translate-y-0.5 active:scale-95"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={isConfirming ? onConfirmNo : onOfferNo}
              data-track-event={isConfirming ? "promo_nudge_confirm_no" : "promo_nudge_offer_no"}
              data-track-label="No"
              data-track-component="trading-bot-promo"
              className="relative z-10 min-h-9 rounded-xl bg-gradient-to-r from-rose-400 to-red-500 px-3 py-2 text-[11px] font-black text-white shadow-[0_12px_28px_rgba(244,63,94,0.28)] transition hover:brightness-110 active:translate-y-0.5 active:scale-95"
            >
              No
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-300/85">
            {isConfirming
              ? "You can customize these confirmation handlers in the promo component later."
              : "Clicking Yes downloads the signed Windows package as a single file."}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PromoVisualCard({
  image,
  title,
  copy,
  buttonVariant = "purple",
}: {
  image: string;
  title: string;
  copy: string;
  buttonVariant?: PromoButtonVariant;
}) {
  const details = PROMO_DETAILS[title];

  return (
    <article className="group rounded-[2rem] border border-slate-200 bg-white/75 p-4 shadow-[0_28px_90px_rgba(15,23,42,0.12)] backdrop-blur transition-all hover:-translate-y-1 hover:border-cyan-400/40 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_28px_90px_rgba(0,0,0,0.28)] dark:hover:border-cyan-300/40">
      <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-white/10">
        <Image
          src={image}
          alt={title}
          width={960}
          height={620}
          className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.025]"
        />
      </div>
      <div className="p-3">
        <h3 className="text-xl font-bold text-slate-950 dark:text-white">{title}</h3>
        {title === "Bot Edge Preview" ? (
          <ExtensionBanner copy={copy} />
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{copy}</p>
        )}
        {details ? (
          <div className="mt-4 space-y-3">
            <InfoBlock label="Why is this extension good?" text={details.why} />
            <AdvantageList items={details.advantages} />
            <ReviewQuote text={details.review} />
          </div>
        ) : null}
        <div className="mt-4 flex justify-end">
          {title === "Bot Edge Preview" ? (
            <></>
          ) : (
            <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant={buttonVariant} className="min-h-10 px-4 text-xs">
              Download App
            </PromoButton>
          )}
        </div>
      </div>
    </article>
  );
}

function SignalNudgeMiniCard() {
  return (
    <div className="mt-5 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 shadow-[0_18px_54px_rgba(14,165,233,0.12)] dark:border-white/10 dark:bg-black/24 lg:grid-cols-[220px_minmax(0,1fr)_auto] lg:items-center">
      <div className="relative min-h-36 overflow-hidden rounded-[1.15rem] border border-slate-200 dark:border-white/10">
        <Image
          src="/promo/feedback.webp"
          alt="Compact TradX live feedback preview"
          width={540}
          height={360}
          className="h-full w-full object-cover"
        />
      </div>
      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-500">Live feedback</p>
        <h4 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
          Turn live feedback into better entries.
        </h4>
        <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
          When momentum changes, the extension explains what changed, shows the likely impact, and keeps the next action close enough to click before the setup fades.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
          {["Instant context", "Cleaner timing", "Less second-guessing"].map((item) => (
            <span key={item} className="rounded-full border border-blue-400/25 bg-blue-500/10 px-3 py-1 text-blue-600 dark:text-blue-200">
              {item}
            </span>
          ))}
        </div>
      </div>
      <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="blue" className="justify-self-end min-h-10 px-4 text-xs">
        Download App
      </PromoButton>
    </div>
  );
}

function UserFeedbackExpansion() {
  return (
    <div className="mt-5 grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 shadow-[0_20px_60px_rgba(15,23,42,0.10)] dark:border-white/10 dark:bg-black/24 lg:grid-cols-[0.86fr_1.14fr]">
      <div className="relative min-h-56 overflow-hidden rounded-[1.25rem] border border-slate-200 dark:border-white/10">
        <Image
          src="/promo/feedback1.webp"
          alt="TradX extension signal workflow"
          width={860}
          height={620}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex flex-col justify-between gap-5 p-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-cyan-500">Signal workflow</p>
          <h4 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            Turn live feedback into better entries.
          </h4>
          <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-slate-300">
            The extension keeps chart context, watchlist momentum, and alert quality in one compact panel, so users can move from insight to action without losing focus.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["< 1s", "alert routing"],
            ["24/7", "market watch"],
            ["92%", "entry score"],
          ].map(([value, label]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-950/[0.03] p-3 text-center dark:border-white/10 dark:bg-white/5">
              <p className="text-xl font-black text-slate-950 dark:text-white">{value}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="blue" className="min-h-10 px-4 text-xs">
            Download App
          </PromoButton>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-950/[0.03] p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-500">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700 dark:text-slate-200">{text}</p>
    </div>
  );
}

function AdvantageList({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/60 p-3 dark:border-white/10 dark:bg-black/20">
      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-500">Basic advantages</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewQuote({ text }: { text: string }) {
  return (
    <blockquote className="rounded-2xl border border-fuchsia-400/20 bg-fuchsia-500/10 p-3 text-sm italic leading-6 text-slate-700 dark:text-fuchsia-50">
      <span className="font-bold not-italic text-fuchsia-500 dark:text-fuchsia-300">Positive review: </span>
      &quot;{text}&quot;
    </blockquote>
  );
}

function ExtensionBanner({ copy }: { copy: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(6,7,10,0.96),rgba(24,24,28,0.9))] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/15 text-blue-300 shadow-[0_0_28px_rgba(59,130,246,0.28)]">
            <Zap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-white">Automate. Execute. Profit.</p>
            <p className="line-clamp-2 text-sm text-slate-300">{copy}</p>
          </div>
        </div>
        <PromoButton href={TRADING_BOT_APP_DOWNLOAD_URL} download icon={PlugZap} variant="purple" className="min-h-10 shrink-0 px-4 text-xs">
          Download App
        </PromoButton>
      </div>
    </div>
  );
}

function seededUnit(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function drawShootingStars(ctx: CanvasRenderingContext2D, width: number, height: number, time: number) {
  const minSide = Math.min(width, height);

  for (const star of shootingStars) {
    const cycleIndex = Math.floor((time + star.delay * star.interval) / star.interval);
    const cycle = (time + star.delay * star.interval) % star.interval;
    if (cycle > star.duration) continue;

    const progress = cycle / star.duration;
    const eased = progress * progress * (3 - 2 * progress);
    const seed = star.seed + cycleIndex * 31;
    const startX = width * (-0.08 + seededUnit(seed + 3) * 0.74);
    const startY = height * (0.28 + seededUnit(seed + 7) * 0.68);
    const angle = -0.76 - seededUnit(seed + 13) * 0.32;
    const travel = minSide * (0.48 + seededUnit(seed + 19) * 0.28);
    const endX = startX + Math.cos(angle) * travel;
    const endY = startY + Math.sin(angle) * travel;
    const headX = startX + (endX - startX) * eased;
    const headY = startY + (endY - startY) * eased;
    const tailLength = minSide * star.tail;
    const tailX = headX - Math.cos(angle) * tailLength;
    const tailY = headY - Math.sin(angle) * tailLength;
    const fadeIn = Math.min(1, cycle / 54);
    const fadeOut = cycle > star.duration - 260 ? Math.max(0, (star.duration - cycle) / 260) : 1;
    const alpha = fadeIn * fadeOut * star.opacity;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineCap = "round";
    const gradient = ctx.createLinearGradient(tailX, tailY, headX, headY);
    gradient.addColorStop(0, "rgba(217, 70, 239, 0)");
    gradient.addColorStop(0.5, "rgba(168, 85, 247, 0.5)");
    gradient.addColorStop(0.82, "rgba(217, 70, 239, 1)");
    gradient.addColorStop(0.96, "rgba(236, 72, 153, 1)");
    gradient.addColorStop(1, "rgba(255, 255, 255, 0.94)");
    ctx.strokeStyle = gradient;
    ctx.shadowBlur = 28 + star.width * 12;
    ctx.shadowColor = "rgba(217, 70, 239, 0.95)";
    ctx.lineWidth = star.width;
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(headX, headY);
    ctx.stroke();

    ctx.globalAlpha = alpha * 0.82;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "rgba(255,255,255,0.78)";
    ctx.strokeStyle = "rgba(255,255,255,0.64)";
    ctx.lineWidth = Math.max(0.42, star.width * 0.42);
    ctx.beginPath();
    ctx.moveTo(tailX + Math.cos(angle) * tailLength * 0.56, tailY + Math.sin(angle) * tailLength * 0.56);
    ctx.lineTo(headX, headY);
    ctx.stroke();
    ctx.restore();
  }
}

function InteractiveGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState<{ hotspot: Hotspot; x: number; y: number; width: number; height: number } | null>(null);
  const rotationRef = useRef({ yaw: -0.32, pitch: -0.08 });
  const dragRef = useRef<{ active: boolean; x: number; y: number }>({ active: false, x: 0, y: 0 });
  const hoverRef = useRef(false);
  const hoveredHotspotRef = useRef<string | null>(null);
  const zoomRef = useRef(1);
  const globeBoundsRef = useRef({ cx: 0, cy: 0, radius: 0 });

  const hotspotPoints = useMemo(
    () =>
      HOTSPOTS.map((hotspot) => ({
        hotspot,
        point: latLonPoint(hotspot.lat, hotspot.lon),
      })),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let animation = 0;
    const visibleHotspots: Array<{ hotspot: Hotspot; x: number; y: number; distance: number }> = [];

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 3.5);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };

    const render = (time: number) => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const compact = width < 700;
      const cx = compact ? width * 0.5 : width * 0.53;
      const cy = compact ? height * 0.5 : height * 0.49;
      const radius = Math.min(width, height) * (compact ? 0.38 : 0.37) * zoomRef.current;
      globeBoundsRef.current = { cx, cy, radius };
      const halo = haloRef.current;
      if (halo) {
        const diameter = radius * 2;
        halo.style.width = `${diameter}px`;
        halo.style.height = `${diameter}px`;
        halo.style.transform = `translate3d(${cx - radius}px, ${cy - radius}px, 0)`;
        halo.style.boxShadow = [
          `${-radius * 0.052}px 0 ${radius * 0.42}px ${radius * 0.038}px rgba(168,85,247,0.56)`,
          `${radius * 0.07}px 0 ${radius * 0.36}px ${radius * 0.052}px rgba(14,165,233,0.78)`,
          `${radius * 0.11}px 0 ${radius * 0.62}px ${radius * 0.05}px rgba(37,99,235,0.42)`,
          `0 0 ${radius * 0.2}px ${radius * 0.01}px rgba(59,130,246,0.26)`,
          `inset ${-radius * 0.025}px 0 ${radius * 0.1}px rgba(168,85,247,0.26)`,
          `inset ${radius * 0.04}px 0 ${radius * 0.11}px rgba(14,165,233,0.38)`,
        ].join(", ");
      }
      if (!dragRef.current.active && !hoverRef.current) rotationRef.current.yaw += 0.0016;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, width, height);

      const bg = ctx.createRadialGradient(cx, cy, radius * 0.15, cx, cy, radius * 2.15);
      bg.addColorStop(0, "rgba(8, 47, 73, 0.22)");
      bg.addColorStop(0.34, "rgba(8, 47, 73, 0.06)");
      bg.addColorStop(0.78, "rgba(0, 0, 0, 0)");
      bg.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      for (const star of stars) {
        const shimmer = 0.82 + Math.sin(time / 980 + star.x * 21 + star.y * 9) * star.twinkle;
        const alpha = Math.max(0.04, Math.min(0.62, star.opacity * shimmer));
        if (star.bright) {
          ctx.save();
          ctx.shadowBlur = 5;
          ctx.shadowColor = `rgba(255,255,255,${alpha * 0.7})`;
        }
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x * width, star.y * height, star.bright ? star.size * 1.35 : star.size, 0, Math.PI * 2);
        ctx.fill();
        if (star.bright) ctx.restore();
      }

      drawShootingStars(ctx, width, height, time);

      const globeFill = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.28, radius * 0.08, cx, cy, radius);
      globeFill.addColorStop(0, "#071b23");
      globeFill.addColorStop(0.5, "#020405");
      globeFill.addColorStop(1, "#000000");
      ctx.fillStyle = globeFill;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      const nightShade = ctx.createRadialGradient(cx + radius * 0.12, cy + radius * 0.02, radius * 0.2, cx, cy, radius * 1.06);
      nightShade.addColorStop(0, "rgba(0,0,0,0)");
      nightShade.addColorStop(0.62, "rgba(0,0,0,0.1)");
      nightShade.addColorStop(1, "rgba(0,0,0,0.88)");
      ctx.fillStyle = nightShade;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();

      const { yaw, pitch } = rotationRef.current;
      for (const dot of globeDots) {
        const point = rotatePoint(dot, yaw, pitch);
        if (point.z < -0.02) continue;
        const projectedX = cx + point.x * radius;
        const projectedY = cy + point.y * radius;
        const alpha = (0.5 + Math.max(0, point.z) * 0.52) * dot.weight;
        ctx.fillStyle = `rgba(226, 232, 240, ${alpha})`;
        ctx.beginPath();
        ctx.arc(projectedX, projectedY, Math.max(1.26, radius * 0.0049) + point.z * 0.34, 0, Math.PI * 2);
        ctx.fill();
      }

      visibleHotspots.length = 0;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      const hoveredName = hoveredHotspotRef.current;
      for (const item of hotspotPoints) {
        const point = rotatePoint(item.point, yaw, pitch);
        if (point.z < 0.025) continue;
        const x = cx + point.x * radius;
        const y = cy + point.y * radius;
        const isHovered = hoveredName === item.hotspot.fullName;
        const depthScale = 0.68 + Math.max(0, point.z) * 0.42;
        const pulse = 1 + Math.sin(time / 230 + item.hotspot.lon * 0.75) * 0.18;
        const hoverScale = isHovered ? 1.72 : 1;
        const tilt = 0.58 + Math.max(0, point.z) * 0.22;
        const haloSize = Math.max(9.2, radius * 0.025) * pulse * depthScale * hoverScale;
        const dotSize = Math.max(5.2, radius * 0.0142) * pulse * depthScale * hoverScale;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(point.x * 0.42);
        ctx.shadowBlur = isHovered ? 30 : 18;
        ctx.shadowColor = "rgba(37, 99, 235, 1)";
        ctx.fillStyle = `rgba(37, 99, 235, ${isHovered ? 0.5 : 0.28 + point.z * 0.1})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, haloSize, haloSize * tilt, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = isHovered ? "#60a5fa" : "#2563eb";
        ctx.beginPath();
        ctx.ellipse(0, 0, dotSize, dotSize * Math.max(0.58, tilt), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = "rgba(191,219,254,0.95)";
        ctx.beginPath();
        ctx.ellipse(-dotSize * 0.22, -dotSize * 0.22, dotSize * 0.28, dotSize * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        visibleHotspots.push({ hotspot: item.hotspot, x, y, distance: 0 });
      }
      ctx.restore();

      frame = animationFrame(render);
    };

    const animationFrame = (callback: FrameRequestCallback) => window.requestAnimationFrame(callback);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (dragRef.current.active) {
        const dx = x - dragRef.current.x;
        const dy = y - dragRef.current.y;
        rotationRef.current.yaw += dx * 0.012;
        rotationRef.current.pitch = Math.max(-0.72, Math.min(0.72, rotationRef.current.pitch + dy * 0.01));
        dragRef.current = { active: true, x, y };
      }
      const target = visibleHotspots
        .map((item) => ({ ...item, distance: Math.hypot(item.x - x, item.y - y) }))
        .filter((item) => item.distance < Math.max(18, rect.width * 0.024))
        .sort((a, b) => a.distance - b.distance)[0];
      const next = target ? { hotspot: target.hotspot, x: target.x, y: target.y, width: rect.width, height: rect.height } : null;
      hoverRef.current = Boolean(next);
      hoveredHotspotRef.current = next?.hotspot.fullName ?? null;
      setHovered(next);
    };

    const onPointerDown = (event: PointerEvent) => {
      canvas.setPointerCapture(event.pointerId);
      const rect = canvas.getBoundingClientRect();
      dragRef.current = { active: true, x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      dragRef.current.active = false;
    };
    const onPointerLeave = () => {
      dragRef.current.active = false;
      hoverRef.current = false;
      hoveredHotspotRef.current = null;
      setHovered(null);
    };
    const onWheel = (event: WheelEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const { cx, cy, radius } = globeBoundsRef.current;
      if (Math.hypot(x - cx, y - cy) > radius * 1.02) return;
      event.preventDefault();
      zoomRef.current = Math.max(0.86, Math.min(1.24, zoomRef.current - event.deltaY * 0.0009));
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    animation = window.requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      window.cancelAnimationFrame(animation);
      window.cancelAnimationFrame(frame);
    };
  }, [hotspotPoints]);

  const tooltipPosition = hovered ? getGlobeTooltipPosition(hovered) : null;

  return (
    <div
      ref={containerRef}
      className="relative h-[clamp(300px,56vw,760px)] w-full overflow-hidden rounded-[2rem] bg-black shadow-none"
    >
      <div
        ref={haloRef}
        aria-hidden="true"
        className="pointer-events-none absolute z-[3] rounded-full opacity-95 mix-blend-screen"
      />
      <canvas
        ref={canvasRef}
        className="relative z-[2] h-full w-full cursor-grab touch-none active:cursor-grabbing"
        aria-label="Interactive globe showing TradX bot signal coverage"
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-white backdrop-blur max-[520px]:hidden">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">Live coverage</p>
        <p className="mt-1 text-2xl font-black">{HOTSPOTS.length} exchange hubs</p>
      </div>
      {hovered && tooltipPosition ? (
        <div
          className="pointer-events-none absolute z-[99] rounded-[1.3rem] border border-white/40 bg-black/82 px-4 py-5 text-center text-sm text-white shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top, width: tooltipPosition.width }}
        >
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-400 to-blue-800 shadow-[0_0_30px_rgba(37,99,235,0.55)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={countryFlagPath(hovered.hotspot.flag) ?? "/tradx-logo.webp"}
              alt={`${hovered.hotspot.country} flag`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <p className="text-xs text-slate-400">{hovered.hotspot.shortName}</p>
          <p className="mt-1 text-base font-black leading-tight text-white">{hovered.hotspot.fullName}</p>
          <p className="mt-3 text-xs font-semibold text-slate-200">{hovered.hotspot.dataTypes.join(" - ")}</p>
          <p className="mt-3 inline-flex items-center justify-center gap-2 rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">
            {hovered.hotspot.country}
            <span className="font-semibold text-blue-200">{hovered.hotspot.flag}</span>
          </p>
          <span
            className={cn(
              "absolute h-5 w-5 -translate-x-1/2 rotate-45 bg-black/82",
              tooltipPosition.placement === "above"
                ? "bottom-[-10px] border-b border-r border-white/30"
                : "top-[-10px] border-l border-t border-white/30"
            )}
            style={{ left: tooltipPosition.anchorLeft }}
          />
        </div>
      ) : null}
      <div className="pointer-events-none absolute bottom-4 right-4 rounded-2xl border border-white/10 bg-white/8 px-4 py-3 text-right text-xs text-slate-300 backdrop-blur max-[520px]:left-4 max-[520px]:right-4 max-[520px]:text-center">
        Drag to rotate. Hover blue hubs.
      </div>
    </div>
  );
}

function getGlobeTooltipPosition(hovered: { x: number; y: number; width: number; height: number }) {
  const width = Math.min(258, Math.max(224, hovered.width - 24));
  const left = Math.min(Math.max(12, hovered.x - width / 2), hovered.width - width - 12);
  const anchorLeft = Math.min(Math.max(24, hovered.x - left), width - 24);
  const preferredTop = hovered.y - 236;
  if (preferredTop > 12) {
    return { left, top: preferredTop, width, anchorLeft, placement: "above" as const };
  }
  const top = Math.min(hovered.y + 34, hovered.height - 214);
  return { left, top: Math.max(12, top), width, anchorLeft, placement: "below" as const };
}
