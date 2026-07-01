import { ModernHero } from "@/components/landing/modern-hero";
import { NewsSection } from "@/components/landing/news-section";
import { ContactSection } from "@/components/landing/contact-section";
import { CoinPricesSection } from "@/components/landing/coin-prices-section";
import { HomeAuthRedirect } from "@/components/auth/home-auth-redirect";
import { TradingBotPromo } from "@/components/landing/trading-bot-promo";

const DISPLAYED_COINS = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"];

export default function HomePage() {
  return (
    <>
      <HomeAuthRedirect />
      <ModernHero />
      <CoinPricesSection />
      <TradingBotPromo />
      <NewsSection coinSymbols={DISPLAYED_COINS} />
      <ContactSection />
    </>
  );
}
