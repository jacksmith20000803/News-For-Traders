import { Globe2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function countryFlagPath(countryCode: string | null | undefined) {
  const normalized = countryCode?.trim().toLowerCase();
  if (!normalized || !/^[a-z]{2}$/.test(normalized)) return null;
  return `/country-flags-main/svg/${normalized}.svg`;
}

export function countryFlagEmoji(countryCode: string | null | undefined) {
  if (!countryCode || countryCode.length !== 2) return "";
  return String.fromCodePoint(
    ...countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0))
  );
}

export function countryDisplayName(countryCode: string | null | undefined) {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return countryCode?.trim() || "";

  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(normalized) || normalized;
  } catch {
    return normalized;
  }
}

export function CountryFlag({
  countryCode,
  countryName,
  className,
}: {
  countryCode: string | null | undefined;
  countryName?: string | null;
  className?: string;
}) {
  const src = countryFlagPath(countryCode);
  const label = countryName || countryCode || "Unknown country";

  if (!src) {
    return (
      <span
        className={cn(
          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border",
          className
        )}
        aria-label={label}
        title={label}
      >
        <Globe2 className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${label} flag`}
      title={label}
      loading="lazy"
      className={cn("inline-flex h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-border", className)}
    />
  );
}
