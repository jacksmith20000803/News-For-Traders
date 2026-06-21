import { cn } from "@/lib/utils";

export function DataUnavailable({ message }: { message: string }) {
  return (
    <div className="terminal-panel flex items-center justify-center py-8 px-4">
      <p className="text-sm text-muted-foreground text-center">{message}</p>
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4 rounded", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="terminal-panel p-4 space-y-3">
      <SkeletonLine className="w-1/3 h-3" />
      <SkeletonLine className="w-full" />
      <SkeletonLine className="w-4/5" />
    </div>
  );
}
