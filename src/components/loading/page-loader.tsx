"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function PageLoader() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 650);

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0b]" suppressHydrationWarning>
      <div className="flex flex-col items-center gap-8" suppressHydrationWarning>
        <div className="relative" suppressHydrationWarning>
          {/* 3D Rotating Circle */}
          <div className="absolute inset-0 flex items-center justify-center" suppressHydrationWarning>
            <div className="w-48 h-48 rounded-full border-4 border-emerald-500/20 animate-spin" style={{ animationDuration: '3s' }} suppressHydrationWarning />
            <div className="absolute w-40 h-40 rounded-full border-4 border-emerald-500/30 animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} suppressHydrationWarning />
            <div className="absolute w-32 h-32 rounded-full border-4 border-emerald-500/40 animate-spin" style={{ animationDuration: '1.5s' }} suppressHydrationWarning />
          </div>
          
          {/* Logo */}
          <div className="relative z-10 flex items-center justify-center" suppressHydrationWarning>
            <div className="absolute inset-0 animate-pulse bg-emerald-500/10 blur-2xl rounded-full" suppressHydrationWarning />
            <Image
              src="/tradx-logo.png"
              alt="TRADX"
              width={300}
              height={90}
              className="relative z-10 object-contain"
              priority
            />
          </div>
        </div>
        
        {/* Loading Text */}
        <div className="flex items-center gap-3" suppressHydrationWarning>
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} suppressHydrationWarning />
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} suppressHydrationWarning />
          <div className="w-3 h-3 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} suppressHydrationWarning />
        </div>
        <p className="text-base text-muted-foreground font-medium tracking-widest uppercase">Loading</p>
      </div>
    </div>
  );
}
