import { AlertsManager } from "@/components/alerts/alerts-manager";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Alert Engine" };

export default async function AlertsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Alert Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Price crosses, percentage change, volatility spikes, and news mentions
        </p>
      </div>
      <AlertsManager />
    </div>
  );
}
