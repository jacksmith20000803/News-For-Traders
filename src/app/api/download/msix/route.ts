import path from "node:path";
import { createWindowsPackageResponse } from "@/lib/download/windows-package-response";

export const runtime = "nodejs";

const DEFAULT_BUNDLE_NAME = "trading-bot-app.msix";

function getBundleName() {
  const configuredUrl = process.env.NEXT_PUBLIC_MSIX_BUNDLE_URL;
  if (!configuredUrl) return DEFAULT_BUNDLE_NAME;

  try {
    const parsed = new URL(configuredUrl);
    const fileName = path.basename(parsed.pathname);
    return fileName || DEFAULT_BUNDLE_NAME;
  } catch {
    return path.basename(configuredUrl) || DEFAULT_BUNDLE_NAME;
  }
}

async function servePackage(request: Request) {
  const bundleName = getBundleName();
  const bundlePath = path.join(process.cwd(), "public", "downloads", bundleName);

  try {
    return await createWindowsPackageResponse({
      request,
      filePath: bundlePath,
      fileName: bundleName,
      cacheControl: "private, max-age=0, must-revalidate",
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return Response.json(
        {
          error:
            "MSIX package is not present yet. Place your signed package in public/downloads or set NEXT_PUBLIC_MSIX_BUNDLE_URL.",
        },
        { status: 404 }
      );
    }

    return Response.json({ error: "Failed to read MSIX package." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return servePackage(request);
}

export async function HEAD(request: Request) {
  return servePackage(request);
}
