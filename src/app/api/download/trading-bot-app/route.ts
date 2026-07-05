import path from "node:path";
import { stat } from "node:fs/promises";
import { after, type NextRequest } from "next/server";
import { createWindowsPackageResponse } from "@/lib/download/windows-package-response";
import { recordTradingBotEvent, resolveTradingBotVisitorId } from "@/lib/download/trading-bot-events";
import { getClientIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const DEFAULT_INSTALLER_NAME = "TradX-Bot.exe";
// MSIX installer default retained for future use:
// const DEFAULT_INSTALLER_NAME = "trading-bot-app.msix";

function getInstallerFileName() {
  const configured = process.env.TRADING_BOT_APP_FILE || process.env.NEXT_PUBLIC_TRADING_BOT_APP_FILE;
  return path.basename(configured || DEFAULT_INSTALLER_NAME);
}

function getInstallerPathCandidates(fileName: string) {
  return [
    path.join(process.cwd(), "public", "downloads", fileName),
    path.join(process.cwd(), "public", fileName),
  ];
}

async function resolveInstallerPath(fileName: string) {
  const candidates = getInstallerPathCandidates(fileName);

  for (const candidate of candidates) {
    try {
      const fileStat = await stat(candidate);
      if (fileStat.isFile()) return candidate;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code !== "ENOENT") throw error;
    }
  }

  return candidates[0];
}

async function serveInstaller(request: NextRequest, recordDownload = false) {
  const fileName = getInstallerFileName();

  try {
    const installerPath = await resolveInstallerPath(fileName);

    if (recordDownload) {
      after(() =>
        recordTradingBotEvent(request, "downloaded").catch((error) => {
          console.error("Failed to record trading bot download:", error);
        })
      );
    }
    const response = await createWindowsPackageResponse({
      request,
      filePath: installerPath,
      fileName,
      cacheControl: "no-store, no-cache, must-revalidate, proxy-revalidate",
    });
    const visitorId = resolveTradingBotVisitorId(
      request,
      getClientIp(request),
      request.headers.get("user-agent") ?? ""
    );
    response.headers.append(
      "Set-Cookie",
      `tradx_visitor_id=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax${
        process.env.NODE_ENV === "production" ? "; Secure" : ""
      }`
    );
    return response;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return Response.json(
        {
          // MSIX message retained for future use:
          // error: "Trading bot installer is not present yet. Place your signed installer in public/downloads/trading-bot-app.msix or set TRADING_BOT_APP_FILE.",
          error:
            "Trading bot installer is not present yet. Place your signed EXE installer at public/TradX-Bot.exe or public/downloads/TradX-Bot.exe, or set TRADING_BOT_APP_FILE.",
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
