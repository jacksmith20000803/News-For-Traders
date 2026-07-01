import { generateAppInstallerXml } from "@/lib/app-installer/generate-appinstaller-xml";

export const runtime = "edge";

const DEFAULT_VERSION = "1.0.0.0";
const DEFAULT_PACKAGE_NAME = "TradXTradingBot";
const DEFAULT_PUBLISHER = "CN=TradX";

export async function GET(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    const version = process.env.NEXT_PUBLIC_MSIX_VERSION || DEFAULT_VERSION;
    const mainPackageName = process.env.NEXT_PUBLIC_MSIX_PACKAGE_NAME || DEFAULT_PACKAGE_NAME;
    const publisher = process.env.NEXT_PUBLIC_MSIX_PUBLISHER || DEFAULT_PUBLISHER;
    const mainPackageUrl =
      process.env.NEXT_PUBLIC_MSIX_BUNDLE_URL || `${origin}/api/download/msix`;
    const appinstallerUrl = `${origin}/api/download/appinstaller`;

    const xml = generateAppInstallerXml({
      version,
      mainPackageUrl,
      mainPackageName,
      publisher,
      appinstallerUrl,
    });

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
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
