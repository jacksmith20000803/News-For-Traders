"use client";

import { cn } from "@/lib/utils";
import { useConnectionStatus } from "@/components/realtime/sse-provider";
import { Radio, Wifi, WifiOff } from "lucide-react";

export function ConnectionStatus() {
  const { status } = useConnectionStatus();

  const config = {
    connected: {
      label: "LIVE",
      sub: "CONNECTED",
      icon: Radio,
      className: "border-accent/30 bg-accent/10 text-accent",
      dot: "bg-accent live-pulse",
    },
    connecting: {
      label: "LIVE",
      sub: "CONNECTING",
      icon: Wifi,
      className: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
      dot: "bg-cyan-400 animate-pulse",
    },
    reconnecting: {
      label: "LIVE",
      sub: "RECONNECTING",
      icon: Wifi,
      className: "border-warning/30 bg-warning/10 text-warning",
      dot: "bg-warning animate-pulse",
    },
    disconnected: {
      label: "OFFLINE",
      sub: "DISCONNECTED",
      icon: WifiOff,
      className: "border-destructive/30 bg-destructive/10 text-destructive",
      dot: "bg-destructive",
    },
  }[status];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider",
        config.className
      )}
      title={`Real-time feed: ${config.sub}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", config.dot)} />
      <Icon className="h-3 w-3" />
      <span>{config.label}</span>
      <span className="hidden sm:inline opacity-70">· {config.sub}</span>
    </div>
  );
}
