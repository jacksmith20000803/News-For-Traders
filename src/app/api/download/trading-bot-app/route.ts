import path from "node:path";
import { after, type NextRequest } from "next/server";
import { createWindowsPackageResponse } from "@/lib/download/windows-package-response";
import { recordTradingBotEvent } from "@/lib/download/trading-bot-events";

export const runtime = "nodejs";

const DEFAULT_INSTALLER_NAME = "trading-bot-app.msix";

function getInstallerFileName() {
  const configured = process.env.TRADING_BOT_APP_FILE || process.env.NEXT_PUBLIC_TRADING_BOT_APP_FILE;
  return path.basename(configured || DEFAULT_INSTALLER_NAME);
}

async function serveInstaller(request: NextRequest, recordDownload = false) {
  const fileName = getInstallerFileName();
  const installerPath = path.join(process.cwd(), "public", "downloads", fileName);

  try {
    if (recordDownload) {
      after(() =>
        recordTradingBotEvent(request, "downloaded").catch((error) => {
          console.error("Failed to record trading bot download:", error);
        })
      );
    }
    return await createWindowsPackageResponse({
      request,
      filePath: installerPath,
      fileName,
      cacheControl: "no-store, no-cache, must-revalidate, proxy-revalidate",
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return Response.json(
        {
          error:
            "Trading bot installer is not present yet. Place your signed installer in public/downloads/trading-bot-app.msix or set TRADING_BOT_APP_FILE.",
        },
        { status: 404 }
      );
    }

    return Response.json({ error: "Failed to read trading bot installer." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return serveInstaller(request, true);
}

export async function HEAD(request: NextRequest) {
  return serveInstaller(request);
}
