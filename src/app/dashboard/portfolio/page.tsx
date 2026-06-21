import { PortfolioDashboard } from "@/components/portfolio/portfolio-dashboard";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Portfolio" };

export default async function PortfolioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Portfolio Tracker</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track positions, P&L, and allocation
        </p>
      </div>
      <PortfolioDashboard />
    </div>
  );
}
