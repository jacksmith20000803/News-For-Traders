import Image from "next/image";
import Link from "next/link";
import { InstallSuccessRecorder } from "@/components/install/install-success-recorder";

const backgroundImage = "/promo/tradx-wall-street-partner-placeholder.webp";

const galleryImages = [
  {
    src: "/promo/tradx-bot-extension-preview.webp",
    label: "@tradx_bot_preview",
    alt: "Replace this image with the installed bot dashboard screenshot",
  },
  {
    src: "/promo/tradx-extension-panel-preview.webp",
    label: "@tradx_extension_panel",
    alt: "Replace this image with the extension control panel screenshot",
  },
  {
    src: "/promo/tradx-mobile-bot-preview.webp",
    label: "@tradx_mobile_workspace",
    alt: "Replace this image with the mobile bot screenshot",
  },
  {
    src: "/promo/tradx-community-gallery-placeholder.webp",
    label: "@tradx_live_feedback",
    alt: "Replace this image with user feedback or rating screenshot",
  },
];

export default function InstallSuccessPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-black text-white">
      <InstallSuccessRecorder />
      <div className="absolute inset-0">
        <Image
          src={backgroundImage}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-28"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(123,92,255,0.22),transparent_28%),linear-gradient(180deg,rgba(0,0,0,0.22),#000_58%)]" />
        <div className="absolute inset-0 install-success-stars" />
        <div className="absolute inset-x-0 bottom-0 h-[42vh] install-success-waves" />
      </div>

      <section className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col items-center px-4 py-10 sm:px-8">
        <div className="mt-3 flex w-full max-w-[520px] items-center justify-center gap-4 text-center">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500 to-fuchsia-300" />
          <p className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
            TradX bot is ready
          </p>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent via-fuchsia-500 to-fuchsia-300" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center pt-10 text-center">
          <h1 className="max-w-6xl bg-gradient-to-r from-[#765cff] via-[#d341d8] to-[#ff73c9] bg-clip-text text-[clamp(3.25rem,10vw,10.4rem)] font-black leading-[0.92] tracking-tight text-transparent drop-shadow-[0_24px_54px_rgba(189,65,216,0.28)]">
            Installation
            <span className="block">Complete</span>
          </h1>

          <p className="mt-8 max-w-4xl text-[clamp(1.7rem,3.1vw,3.4rem)] font-extrabold leading-tight text-white">
            The bot has been successfully installed.
          </p>
          <p className="mt-3 max-w-3xl text-lg font-medium leading-8 text-white/78 sm:text-2xl">
            Experience a completely free environment!
          </p>

          <Link
            href="/dashboard"
            className="mb-14 mt-8 inline-flex min-h-14 items-center justify-center rounded-full bg-white px-9 text-base font-extrabold text-black shadow-[0_26px_70px_rgba(255,255,255,0.22)] transition-all hover:-translate-y-1 hover:bg-white/90 active:translate-y-0.5 active:scale-95"
          >
            Explore your bot
          </Link>
        </div>

        <div className="grid w-full gap-7 pb-8 md:grid-cols-2 xl:grid-cols-4">
          {galleryImages.map((image) => (
            <article
              key={image.src}
              className="group rounded-[1.45rem] text-left transition-transform duration-500 hover:-translate-y-2"
            >
              <div className="relative aspect-[1.08/1] overflow-hidden rounded-[1.2rem] border border-white/16 bg-white/5 shadow-[0_26px_70px_rgba(0,0,0,0.58)]">
                <Image
                  src={image.src}
                  alt={image.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-white/5" />
              </div>
              <p className="mt-3 text-sm font-medium text-white/70 sm:text-base">{image.label}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
