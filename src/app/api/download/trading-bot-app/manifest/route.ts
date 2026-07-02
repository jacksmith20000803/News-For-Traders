import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_INSTALLER_NAME = "trading-bot-app.msix";
const DEFAULT_VERSION = "0.0.0-dev";

function getInstallerFileName() {
  const configured = process.env.TRADING_BOT_APP_FILE || process.env.NEXT_PUBLIC_TRADING_BOT_APP_FILE;
  return path.basename(configured || DEFAULT_INSTALLER_NAME);
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const fileName = getInstallerFileName();
  const installerPath = path.join(process.cwd(), "public", "downloads", fileName);

  try {
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
          error:
            "Trading bot installer is not present yet. Place your signed installer in public/downloads/trading-bot-app.msix or set TRADING_BOT_APP_FILE.",
          expectedFileName: fileName,
        },
        { status: 404 }
      );
    }

    return Response.json({ error: "Failed to read trading bot installer manifest." }, { status: 500 });
  }
}
