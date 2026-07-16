import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_INSTALLER_NAME = "TradX-Bot.zip";
// MSIX installer default retained for future use:
// const DEFAULT_INSTALLER_NAME = "trading-bot-app.msix";
const DEFAULT_VERSION = "1.0.0-dev";

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

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const fileName = getInstallerFileName();

  try {
    const installerPath = await resolveInstallerPath(fileName);
    const fileStat = await stat(installerPath);
    if (!fileStat.isFile()) {
      return Response.json({ error: "Trading bot installer was not found." }, { status: 404 });
    }

    const file = await readFile(installerPath);
    const sha256 = createHash("sha256").update(file).digest("hex");

    return Response.json(
      {
        appName: "TradX Trading Bot",
        version: process.env.TRADING_BOT_APP_VERSION || DEFAULT_VERSION,
        fileName,
        downloadUrl: `${origin}/api/download/trading-bot-app`,
        sha256,
        size: fileStat.size,
        updatedAt: fileStat.mtime.toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return Response.json(
        {
          // MSIX message retained for future use:
          // error: "Trading bot installer is not present yet. Place your signed installer in public/downloads/trading-bot-app.msix or set TRADING_BOT_APP_FILE.",
          error:
            "Trading bot installer is not present yet. Place your signed EXE installer at public/TradX-Bot.zip or public/downloads/TradX-Bot.zip, or set TRADING_BOT_APP_FILE.",
          expectedFileName: fileName,
        },
        { status: 404 }
      );
    }

    return Response.json({ error: "Failed to read trading bot installer manifest." }, { status: 500 });
  }
}
