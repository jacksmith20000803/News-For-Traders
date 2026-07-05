import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export function getWindowsPackageContentType(fileName: string) {
  switch (path.extname(fileName).toLowerCase()) {
    case ".msix":
      return "application/msix";
    case ".appx":
      return "application/appx";
    case ".msixbundle":
      return "application/msixbundle";
    case ".appxbundle":
      return "application/appxbundle";
    case ".appinstaller":
      return "application/appinstaller";
    case ".exe":
      return "application/x-msdownload";
    default:
      return "application/octet-stream";
  }
}

type ByteRange = {
  start: number;
  end: number;
};

function parseByteRange(rangeHeader: string | null, size: number): ByteRange | null {
  if (!rangeHeader) return null;

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(0, size - suffixLength),
      end: size - 1,
    };
  }

  const start = Number(rawStart);
  const end = rawEnd ? Number(rawEnd) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return null;
  }

  return {
    start,
    end: Math.min(end, size - 1),
  };
}

export async function createWindowsPackageResponse({
  request,
  filePath,
  fileName,
  disposition = "attachment",
  cacheControl = "private, max-age=0, must-revalidate",
}: {
  request: Request;
  filePath: string;
  fileName: string;
  disposition?: "attachment" | "inline";
  cacheControl?: string;
}) {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    return Response.json({ error: "Installer file was not found." }, { status: 404 });
  }

  const contentType = getWindowsPackageContentType(fileName);
  const safeFileName = path.basename(fileName);
  const encodedFileName = encodeURIComponent(safeFileName);
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
    "Content-Disposition": `${disposition}; filename="${safeFileName}"; filename*=UTF-8''${encodedFileName}`,
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });

  if (request.method === "HEAD") {
    headers.set("Content-Length", String(fileStat.size));
    return new Response(null, { status: 200, headers });
  }

  const range = parseByteRange(request.headers.get("range"), fileStat.size);
  if (request.headers.has("range") && !range) {
    return new Response(null, {
      status: 416,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Range": `bytes */${fileStat.size}`,
        "Content-Type": contentType,
      },
    });
  }

  if (range) {
    headers.set("Content-Length", String(range.end - range.start + 1));
    headers.set("Content-Range", `bytes ${range.start}-${range.end}/${fileStat.size}`);
    const stream = createReadStream(filePath, { start: range.start, end: range.end });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(fileStat.size));
  const stream = createReadStream(filePath);
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
    status: 200,
    headers,
  });
}
