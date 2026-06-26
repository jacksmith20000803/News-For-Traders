import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/dashboard");
  if (!user.onboardingCompleted) redirect("/onboarding");

  return <DashboardHome />;
}
