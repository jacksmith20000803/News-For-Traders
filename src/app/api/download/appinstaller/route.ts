import { generateAppInstallerXml } from "@/lib/app-installer/generate-appinstaller-xml";
import { readMsixIdentity } from "@/lib/app-installer/read-msix-manifest";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_VERSION = "1.0.0.0";
const DEFAULT_PACKAGE_NAME = "TradXTradingBot";
const DEFAULT_PUBLISHER = "CN=TradX";
const DEFAULT_PACKAGE_FILE = "trading-bot-app.msix";

function getPackageFileName(packageUrl: string) {
  const configured = process.env.TRADING_BOT_APP_FILE || process.env.NEXT_PUBLIC_TRADING_BOT_APP_FILE;
  if (configured) return path.basename(configured);

  try {
    return path.basename(new URL(packageUrl).pathname) || DEFAULT_PACKAGE_FILE;
  } catch {
    return path.basename(packageUrl) || DEFAULT_PACKAGE_FILE;
  }
}

async function getPackageIdentity(packageUrl: string, packageKind: "package" | "bundle") {
  if (packageKind === "bundle") {
    return {
      name: process.env.NEXT_PUBLIC_MSIX_PACKAGE_NAME || DEFAULT_PACKAGE_NAME,
      publisher: process.env.NEXT_PUBLIC_MSIX_PUBLISHER || DEFAULT_PUBLISHER,
      version: process.env.NEXT_PUBLIC_MSIX_VERSION || DEFAULT_VERSION,
      processorArchitecture: undefined,
    };
  }

  const localPackagePath = path.join(
    process.cwd(),
    "public",
    "downloads",
    getPackageFileName(packageUrl)
  );

  try {
    const identity = await readMsixIdentity(localPackagePath);
    return {
      name: process.env.NEXT_PUBLIC_MSIX_PACKAGE_NAME || identity.name,
      publisher: process.env.NEXT_PUBLIC_MSIX_PUBLISHER || identity.publisher,
      version: process.env.NEXT_PUBLIC_MSIX_VERSION || identity.version,
      processorArchitecture: identity.processorArchitecture,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[appinstaller] Falling back to configured package identity.", error);
    }

    return {
      name: process.env.NEXT_PUBLIC_MSIX_PACKAGE_NAME || DEFAULT_PACKAGE_NAME,
      publisher: process.env.NEXT_PUBLIC_MSIX_PUBLISHER || DEFAULT_PUBLISHER,
      version: process.env.NEXT_PUBLIC_MSIX_VERSION || DEFAULT_VERSION,
      processorArchitecture: undefined,
    };
  }
}

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const mainPackageUrl =
      process.env.NEXT_PUBLIC_MSIX_BUNDLE_URL || `${origin}/api/download/msix`;
    const packageKind =
      process.env.NEXT_PUBLIC_MSIX_PACKAGE_KIND === "bundle" ||
      /\.(msixbundle|appxbundle)(?:$|\?)/i.test(mainPackageUrl)
        ? "bundle"
        : "package";
    const appinstallerUrl = `${origin}/api/download/appinstaller`;
    const identity = await getPackageIdentity(mainPackageUrl, packageKind);

    const xml = generateAppInstallerXml({
      version: identity.version,
      mainPackageUrl,
      mainPackageName: identity.name,
      publisher: identity.publisher,
      appinstallerUrl,
      mainPackageKind: packageKind,
      processorArchitecture: identity.processorArchitecture,
    });

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/appinstaller; charset=utf-8",
        "Content-Disposition": 'inline; filename="TradingBot.appinstaller"',
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate app installer.";
    return Response.json({ error: message }, { status: 500 });
  }
}
