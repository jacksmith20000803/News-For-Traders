import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { TradingBotPromo } from "@/components/landing/trading-bot-promo";
import { getTradingBotDownloadUrl } from "@/lib/download/trading-bot-settings";

export const metadata = { title: "Download" };

export default async function DashboardDownloadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/dashboard/download");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const tradingBotDownloadUrl = await getTradingBotDownloadUrl();

  return <TradingBotPromo downloadUrl={tradingBotDownloadUrl} />;
}
