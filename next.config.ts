import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: https://static2.finnhub.io https://images.investinglive.com",
      "font-src 'self' data:",
      "connect-src 'self' https://puter.com https://*.puter.com",
      "frame-src 'self' https://puter.com https://*.puter.com",
      "frame-ancestors 'self'",
    ].join("; "),
  },
];

const immutableAssetHeaders = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];

const noStoreRuntimeHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@heyputer/puter.js/dist/**/*"],
  },
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static2.finnhub.io",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.investinglive.com",
        port: "",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.investinglive.com",
        port: "",
        pathname: "/**",
      },
    ],
    qualities: [75, 85],
    unoptimized: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: noStoreRuntimeHeaders },
      { source: "/service-worker.js", headers: noStoreRuntimeHeaders },
      { source: "/coin-avatar/:path*", headers: immutableAssetHeaders },
      { source: "/coin-backgrounds/:path*", headers: immutableAssetHeaders },
      { source: "/coin-badge/:path*", headers: immutableAssetHeaders },
      { source: "/country-flags-main/:path*", headers: immutableAssetHeaders },
      { source: "/promo/:path*", headers: immutableAssetHeaders },
      { source: "/tradx-logo.webp", headers: immutableAssetHeaders },
      { source: "/favicon.ico", headers: immutableAssetHeaders },
      { source: "/default-news.webp", headers: immutableAssetHeaders },
    ];
  },
};

export default nextConfig;
