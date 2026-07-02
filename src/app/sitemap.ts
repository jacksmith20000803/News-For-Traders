import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tradx.app";

const publicRoutes = [
  "",
  "/assets",
  "/calendar",
  "/charts",
  "/community",
  "/heatmap",
  "/login",
  "/news",
  "/register",
  "/research",
  "/support",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return publicRoutes.map((route) => ({
    url: `${appUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "" || route === "/news" ? "hourly" : "weekly",
    priority: route === "" ? 1 : route === "/news" ? 0.9 : 0.7,
  }));
}
