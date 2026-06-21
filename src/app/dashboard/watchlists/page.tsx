import { WatchlistManager } from "@/components/watchlists/watchlist-manager";
import Link from "next/link";

export const metadata = { title: "Watchlists" };

export default function WatchlistsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Advanced Watchlists</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Multiple lists, drag-and-drop ordering, and price alerts
          </p>
        </div>
        <Link href="/dashboard/alerts" className="text-xs text-cyan-400 hover:underline">
          Manage all alerts →
        </Link>
      </div>
      <WatchlistManager />
    </div>
  );
}
