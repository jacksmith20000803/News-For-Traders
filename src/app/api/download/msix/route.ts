import { readFile, stat } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const DEFAULT_BUNDLE_NAME = "TradingBot.msixbundle";

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

export async function GET() {
  const bundleName = getBundleName();
  const bundlePath = path.join(process.cwd(), "public", "downloads", bundleName);

  try {
    const fileStat = await stat(bundlePath);
    if (!fileStat.isFile()) {
      return Response.json({ error: "MSIX bundle was not found." }, { status: 404 });
    }

    const file = await readFile(bundlePath);
    return new Response(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-appxBundle",
        "Content-Disposition": `attachment; filename="${bundleName}"`,
        "Content-Length": String(fileStat.size),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? error.code : null;
    if (code === "ENOENT") {
      return Response.json(
        {
          error:
            "MSIX bundle is not present yet. Place your signed bundle in public/downloads or set NEXT_PUBLIC_MSIX_BUNDLE_URL.",
        },
        { status: 404 }
      );
    }

    return Response.json({ error: "Failed to read MSIX bundle." }, { status: 500 });
  }
}

export async function HEAD() {
  const bundleName = getBundleName();
  const bundlePath = path.join(process.cwd(), "public", "downloads", bundleName);

  try {
    const fileStat = await stat(bundlePath);
    if (!fileStat.isFile()) {
      return new Response(null, { status: 404 });
    }

    return new Response(null, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.ms-appxBundle",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}
