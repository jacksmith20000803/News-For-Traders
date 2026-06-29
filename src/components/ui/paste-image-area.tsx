"use client";

import { useEffect, useRef, useState } from "react";

interface PasteImageAreaProps {
  maxSizeMB?: number;
  onImageChange?: (file: File | null, previewUrl: string | null) => void;
  className?: string;
}

interface PastedImageState {
  file: File;
  previewUrl: string;
  size: number;
}

const DEFAULT_MAX_SIZE_MB = 5;
const ERROR_TIMEOUT_MS = 3000;

export function PasteImageArea({
  maxSizeMB = DEFAULT_MAX_SIZE_MB,
  onImageChange,
  className = "",
}: PasteImageAreaProps) {
  const [image, setImage] = useState<PastedImageState | null>(null);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const objectUrlRef = useRef<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearErrorTimer = () => {
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  };

  const showError = (message: string) => {
    clearErrorTimer();
    setError(message);
    setAnnouncement(message);
    errorTimerRef.current = setTimeout(() => {
      setError("");
      errorTimerRef.current = null;
    }, ERROR_TIMEOUT_MS);
  };

  const revokeCurrentObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const clearImage = () => {
    revokeCurrentObjectUrl();
    setImage(null);
    setAnnouncement("Pasted screenshot removed.");
    onImageChange?.(null, null);
  };

  const acceptImage = (file: File) => {
    const maxBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxBytes) {
      showError(`Image is larger than ${maxSizeMB} MB.`);
      return;
    }

    revokeCurrentObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setImage({ file, previewUrl, size: file.size });
    setError("");
    setAnnouncement("Screenshot pasted successfully. Preview is ready.");
    onImageChange?.(file, previewUrl);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.textContent = "";

    const imageItem = Array.from(event.clipboardData.items).find((item) =>
      item.type.startsWith("image/")
    );

    if (!imageItem) {
      showError("No image found in clipboard.");
      return;
    }

    const pastedFile = imageItem.getAsFile();
    if (!pastedFile) {
      showError("Could not read the pasted image.");
      return;
    }

    const safeName = pastedFile.name || `pasted-screenshot-${Date.now()}.${mimeExtension(pastedFile.type)}`;
    const imageFile =
      pastedFile instanceof File && pastedFile.name
        ? pastedFile
        : new File([pastedFile], safeName, {
            type: pastedFile.type || "image/png",
            lastModified: Date.now(),
          });

    acceptImage(imageFile);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
    }
  };

  useEffect(() => {
    return () => {
      clearErrorTimer();
      revokeCurrentObjectUrl();
    };
  }, []);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="relative">
        <div
          contentEditable
          suppressContentEditableWarning
          tabIndex={0}
          role="button"
          aria-label="Paste screenshot area"
          aria-describedby="paste-image-help paste-image-status"
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          className="flex min-h-[240px] cursor-text items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white/80 p-4 text-center outline-none transition-colors hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-white/20 dark:bg-black/20 dark:hover:border-blue-400 dark:focus:border-blue-400"
        >
          {image ? (
            <div className="flex flex-col items-center gap-3">
              <p id="paste-image-help" className="sr-only">
                Click here and press Ctrl+V to replace your pasted screenshot
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt="Pasted screenshot preview"
                className="h-[200px] w-[200px] rounded-lg border border-gray-200 object-cover shadow-sm dark:border-white/10"
              />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {formatBytes(image.size)}
              </p>
            </div>
          ) : (
            <p id="paste-image-help" className="max-w-xs text-sm font-medium text-gray-500 dark:text-gray-300">
              Click here and press Ctrl+V to paste your screenshot
            </p>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 shadow-lg dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-200"
          >
            {error}
          </div>
        )}
      </div>

      {image && (
        <button
          type="button"
          onClick={clearImage}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-red-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/25 dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:border-red-400 dark:hover:text-red-300"
          aria-label="Remove pasted screenshot"
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
          Remove
        </button>
      )}

      <p id="paste-image-status" className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
    </div>
  );
}

function mimeExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/png") return "png";
  return "png";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
