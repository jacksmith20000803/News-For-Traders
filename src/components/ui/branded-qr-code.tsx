"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BrandedQRCodeProps {
  qrDataUrl: string;
  logoSrc?: string;
  size?: number;
  logoSizePercent?: number;
  alt?: string;
  showDownload?: boolean;
}

type RenderState = "idle" | "loading" | "ready" | "error";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image: ${src}`));
    image.decoding = "async";
    image.crossOrigin = "anonymous";
    image.src = src;
  });
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

export function BrandedQRCode({
  qrDataUrl,
  logoSrc = "/tradx-logo.webp",
  size = 300,
  logoSizePercent = 22,
  alt = "Scan with authenticator app",
  showDownload = true,
}: BrandedQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderedDataUrl, setRenderedDataUrl] = useState("");
  const [state, setState] = useState<RenderState>("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function composeQrCode() {
      if (!qrDataUrl) {
        setRenderedDataUrl("");
        setState("idle");
        return;
      }

      setState("loading");
      setError("");

      const canvas = canvasRef.current ?? document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        setState("error");
        setError("This browser does not support QR code rendering.");
        return;
      }

      canvas.width = size;
      canvas.height = size;

      try {
        const qrImage = await loadImage(qrDataUrl);
        if (cancelled) return;

        context.clearRect(0, 0, size, size);
        context.drawImage(qrImage, 0, 0, size, size);

        try {
          const logo = await loadImage(logoSrc);
          if (cancelled) return;

          const logoSize = Math.max(24, Math.min(size * 0.28, size * (logoSizePercent / 100)));
          const padding = logoSize * 0.12;
          const backgroundSize = logoSize + padding * 2;
          const backgroundX = (size - backgroundSize) / 2;
          const backgroundY = (size - backgroundSize) / 2;
          const logoX = (size - logoSize) / 2;
          const logoY = (size - logoSize) / 2;

          context.save();
          context.fillStyle = "#ffffff";
          context.shadowColor = "rgba(15, 23, 42, 0.18)";
          context.shadowBlur = Math.max(4, size * 0.025);
          roundedRect(context, backgroundX, backgroundY, backgroundSize, backgroundSize, padding * 1.25);
          context.fill();
          context.restore();
          context.drawImage(logo, logoX, logoY, logoSize, logoSize);
        } catch (logoError) {
          console.warn("[BrandedQRCode] Logo failed to load; rendering plain QR code.", logoError);
        }

        if (cancelled) return;
        setRenderedDataUrl(canvas.toDataURL("image/png"));
        setState("ready");
      } catch {
        if (cancelled) return;
        setRenderedDataUrl("");
        setState("error");
        setError("Could not render the QR code.");
      }
    }

    void composeQrCode();

    return () => {
      cancelled = true;
    };
  }, [logoSizePercent, logoSrc, qrDataUrl, size]);

  const isLoading = state === "idle" || state === "loading";

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas ref={canvasRef} width={size} height={size} className="hidden" aria-hidden="true" />

      <div
        className={cn(
          "relative overflow-hidden rounded-3xl border border-border bg-white p-3 shadow-xl shadow-black/10",
          isLoading && "animate-pulse"
        )}
        style={{ width: size + 24, height: size + 24 }}
      >
        {isLoading ? (
          <div className="h-full w-full rounded-2xl bg-gray-200" role="status" aria-label="Generating QR code" />
        ) : renderedDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={renderedDataUrl}
            alt={alt}
            width={size}
            height={size}
            className="h-full w-full rounded-2xl object-contain"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl bg-destructive/10 p-4 text-center text-sm font-semibold text-destructive">
            {error || "QR code unavailable"}
          </div>
        )}
      </div>

      {showDownload && renderedDataUrl ? (
        <a
          href={renderedDataUrl}
          download="tradx-authenticator-qr.png"
          className="text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Download QR code
        </a>
      ) : null}
    </div>
  );
}
