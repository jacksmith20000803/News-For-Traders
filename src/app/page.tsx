import { ModernHero } from "@/components/landing/modern-hero";
import { NewsSection } from "@/components/landing/news-section";
import { ContactSection } from "@/components/landing/contact-section";
import { CoinPricesSection } from "@/components/landing/coin-prices-section";
import { HomeAuthRedirect } from "@/components/auth/home-auth-redirect";
import { TradingBotPromo } from "@/components/landing/trading-bot-promo";
import { getTradingBotDownloadConfig } from "@/lib/download/trading-bot-settings";

const DISPLAYED_COINS = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE"];

export default async function HomePage() {
  const tradingBotDownloadConfig = await getTradingBotDownloadConfig();

  return (
    <>
      <HomeAuthRedirect />
      <div id="home" className="scroll-mt-20">
        <ModernHero />
      </div>
      <div id="prices" className="scroll-mt-20">
        <CoinPricesSection />
      </div>
      <div id="best-bot" className="scroll-mt-20">
        <TradingBotPromo downloadConfig={tradingBotDownloadConfig} />
      </div>
      <div id="news" className="scroll-mt-20">
        <NewsSection coinSymbols={DISPLAYED_COINS} />
      </div>
      <div id="contact" className="scroll-mt-20">
        <ContactSection />
      </div>
    </>
  );
}
