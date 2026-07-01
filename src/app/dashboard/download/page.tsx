import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TradingBotPromo } from "@/components/landing/trading-bot-promo";

export const metadata = { title: "Download" };

export default async function DashboardDownloadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/dashboard/download");
  if (!user.onboardingCompleted) redirect("/onboarding");

  return <TradingBotPromo />;
}
