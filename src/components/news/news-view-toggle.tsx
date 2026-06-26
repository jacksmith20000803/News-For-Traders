"use client";

import { List, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type ViewMode = "list" | "card";

export function NewsViewToggle() {
  // Initialize state from localStorage directly
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("news-view-mode") as ViewMode | null;
      if (saved === "list" || saved === "card") {
        return saved;
      }
    }
    return "list";
  });

  // Save preference to localStorage when changed
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("news-view-mode", mode);
    // Dispatch custom event to notify NewsCard components
    window.dispatchEvent(new CustomEvent("news-view-change", { detail: { mode } }));
  };

  return (
    <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1" suppressHydrationWarning>
      <Button
        variant={viewMode === "list" ? "default" : "ghost"}
        size="sm"
        onClick={() => handleViewChange("list")}
        className="h-8 w-8 p-0"
        suppressHydrationWarning
      >
        <List className="h-4 w-4" />
      </Button>
      <Button
        variant={viewMode === "card" ? "default" : "ghost"}
        size="sm"
        onClick={() => handleViewChange("card")}
        className="h-8 w-8 p-0"
        suppressHydrationWarning
      >
        <LayoutGrid className="h-4 w-4" />
      </Button>
    </div>
  );
}
