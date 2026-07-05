import Image from "next/image";
import { AppInstallButton } from "@/components/ui/app-install-button";
import { TradingBotDownloadButton } from "@/components/ui/trading-bot-download-button";
import { getTradingBotDownloadConfig } from "@/lib/download/trading-bot-settings";

export const metadata = {
  title: "TradX Trading Bot Download",
  description: "Download the TradX Windows trading bot installer.",
};

export default async function PromotionsPage() {
  const tradingBotDownloadConfig = await getTradingBotDownloadConfig();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_15%_10%,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_86%_18%,rgba(59,130,246,0.16),transparent_32%),#050708] px-4 py-16 text-white sm:px-6">
      <section className="mx-auto grid w-full max-w-6xl gap-8 rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-[0_30px_120px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:grid-cols-[0.95fr_1.05fr] lg:p-8">
        <div className="flex flex-col justify-center gap-6">
          <div className="inline-flex w-fit rounded-full border border-emerald-300/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
            Windows trading-bot-app
          </div>
          <div>
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
              Download the TradX trading bot in one clean flow.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-8 text-slate-300">
              The install button downloads the current signed Windows package from one stable URL. Open the downloaded package to continue installation.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            {/*
            MSIX/App Installer button retained for future use:
            <AppInstallButton
              appName="Trading Bot"
              msixDirectUrl="/api/download/msix"
              directFallbackUrl="/api/download/trading-bot-app"
              directFallbackFileName="trading-bot-app.msix"
            />
            */}
            <AppInstallButton
              appName="Trading Bot"
              downloadConfig={tradingBotDownloadConfig}
            />
            {/*
            MSIX direct package link retained for future use:
            <a
              href="/api/download/trading-bot-app"
              download="trading-bot-app.msix"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-500 px-5 text-sm font-bold text-white shadow-[0_18px_48px_rgba(59,130,246,0.28)] transition hover:-translate-y-1 hover:brightness-110 active:translate-y-0.5 active:scale-95"
            >
              Download MSIX package
            </a>
            */}
            <TradingBotDownloadButton downloadConfig={tradingBotDownloadConfig}>
              Download EXE installer
            </TradingBotDownloadButton>
            <a
              href="/api/download/trading-bot-app/manifest"
              className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/8 px-5 text-sm font-bold text-white transition hover:bg-white/14 active:scale-95"
            >
              Version manifest
            </a>
          </div>
          {/*
          MSIX/App Installer note retained for future use:
          <p className="max-w-xl text-xs leading-6 text-slate-400">
            Browsers cannot silently install apps after download. Store-like installation requires a signed MSIX/App Installer package and still asks the user to approve installation.
          </p>
          */}
          <p className="max-w-xl text-xs leading-6 text-slate-400">
            Browsers cannot silently run installers after download. Open the downloaded EXE and approve the Windows prompts to continue installation.
          </p>
        </div>

        <div className="relative min-h-[340px] overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/30">
          <Image
            src="/promo/tradx-bot-extension-preview.webp"
            alt="TradX trading bot preview placeholder"
            width={960}
            height={620}
            className="h-full w-full object-cover opacity-90"
            priority
          />
          <div className="absolute inset-x-5 bottom-5 rounded-2xl border border-white/10 bg-black/60 p-4 backdrop-blur-xl">
            <p className="text-sm font-bold text-white">Replace this mockup with the production Windows app screenshot.</p>
            <p className="mt-1 text-xs text-slate-300">Native auto-updates can poll `/api/download/trading-bot-app/manifest` for version and hash changes.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
