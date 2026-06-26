"use client";

import Link from "next/link";
import { Bot } from "lucide-react";

export function AskAIFloat() {
  return (
    <Link
      href="/ai"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/30 via-primary/20 to-primary/10 px-5 py-3.5 text-sm font-bold text-primary shadow-[0_8px_32px_rgba(0,0,0,0.3),0_0_0_1px_rgba(255,255,255,0.1)_inset] hover:shadow-[0_12px_40px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.2)_inset] hover:-translate-y-2 hover:scale-110 transition-all duration-300 backdrop-blur-xl group"
    >
      <Bot className="h-5 w-5 animate-pulse group-hover:animate-bounce" />
      Ask AI
    </Link>
  );
}
