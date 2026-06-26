import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "header" | "hero" | "footer";
  className?: string;
  showTagline?: boolean;
}

export function Logo({ variant = "header", className, showTagline = false }: LogoProps) {
  const sizes = {
    header: { width: 240, height: 72, imgClass: "h-16 w-auto" },
    hero: { width: 400, height: 150, imgClass: "h-32 sm:h-40 w-auto" },
    footer: { width: 200, height: 60, imgClass: "h-14 w-auto" },
  };

  const { width, height, imgClass } = sizes[variant];

  return (
    <Link href="/" className={cn("flex shrink-0 flex-col items-start gap-1", className)}>
      <div className="relative">
        <Image
          src="/tradx-logo.png"
          alt="TRADX — Trade. Invest. Grow."
          width={width}
          height={height}
          className={cn(imgClass, "object-contain object-left transition-all duration-500", variant === "header" && "animate-logo-glow")}
          style={imgClass.includes("w-auto") ? { width: "auto" } : { height: "auto" }}
          priority={variant === "header"}
        />
        <style jsx>{`
          @keyframes logo-glow {
            0%, 100% { filter: drop-shadow(0 0 0px rgba(16, 185, 129, 0)); }
            50% { filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.4)); }
          }
          .animate-logo-glow {
            animation: logo-glow 30s ease-in-out infinite;
          }
        `}</style>
      </div>
      {showTagline && (
        <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-muted-foreground">
          Trade. Invest. Grow.
        </span>
      )}
    </Link>
  );
}
