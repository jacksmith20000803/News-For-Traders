import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://tradx.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/api/",
          "/dashboard/settings",
          "/dashboard/activity",
          "/dashboard/notifications",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
