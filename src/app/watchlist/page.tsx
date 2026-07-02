import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { connection } from "next/server";

export default async function WatchlistPage() {
  await connection();

  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const watchlists = await db.watchlist.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Watchlists</h1>
            <p className="text-muted-foreground">Manage your asset watchlists</p>
          </div>
          <Link
            href="/dashboard/watchlists"
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90"
          >
            Create Watchlist
          </Link>
        </div>

        {watchlists.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No watchlists yet</p>
            <Link
              href="/dashboard/watchlists"
              className="text-primary hover:underline"
            >
              Create your first watchlist
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {watchlists.map((watchlist) => (
              <Link
                key={watchlist.id}
                href={`/dashboard/watchlists/${watchlist.id}`}
                className="p-6 rounded-lg border border-white/10 bg-card hover:border-primary/30 transition-colors"
              >
                <h3 className="text-lg font-semibold mb-2">{watchlist.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {watchlist.category || "Custom"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
