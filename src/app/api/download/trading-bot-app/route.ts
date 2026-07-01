import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_INSTALLER_NAME = "trading-bot-app.exe";

function getInstallerFileName() {
  const configured = process.env.TRADING_BOT_APP_FILE || process.env.NEXT_PUBLIC_TRADING_BOT_APP_FILE;
  return path.basename(configured || DEFAULT_INSTALLER_NAME);
}

export async function GET() {
  const fileName = getInstallerFileName();
  const installerPath = path.join(process.cwd(), "public", "downloads", fileName);

  try {
    const fileStat = await stat(installerPath);
    if (!fileStat.isFile()) {
      return Response.json({ error: "Trading bot installer was not found." }, { status: 404 });
    }

    const file = await readFile(installerPath);

    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.microsoft.portable-executable",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "X-Content-Type-Options": "nosniff",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return Response.json(
        {
          error:
            "Trading bot installer is not present yet. Place your signed installer in public/downloads/trading-bot-app.exe or set TRADING_BOT_APP_FILE.",
        },
        { status: 404 }
      );
    }

    return Response.json({ error: "Failed to read trading bot installer." }, { status: 500 });
  }
}
