import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="relative isolate mt-auto overflow-hidden border-t border-gray-200 bg-white/95 text-gray-900 transition-colors dark:border-white/10 dark:bg-[#0b0f12]/95 dark:text-white pb-24 lg:pb-10" suppressHydrationWarning>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6" suppressHydrationWarning>
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.45fr_1fr_1fr_1fr]" suppressHydrationWarning>
          <div className="max-w-sm" suppressHydrationWarning>
            <Image
              src="/tradx-logo.png"
              alt="TRADX"
              width={88}
              height={88}
              className="mb-5 h-[88px] w-[88px] object-contain object-left"
              style={{ width: "88px", height: "88px" }}
            />
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground mb-2">
              Trade. Invest. Grow.
            </p>
            <p className="max-w-xs text-sm leading-6 text-muted-foreground">
              Professional trading intelligence for serious traders.
            </p>
          </div>
          <div suppressHydrationWarning>
            <h4 className="font-semibold mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/charts" className="hover:text-foreground">Charts</Link></li>
              <li><Link href="/heatmap" className="hover:text-foreground">Heatmap</Link></li>
              <li><Link href="/ai" className="hover:text-foreground">AI Assistant</Link></li>
              <li><Link href="/community" className="hover:text-foreground">Community</Link></li>
            </ul>
          </div>
          <div suppressHydrationWarning>
            <h4 className="font-semibold mb-3">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/register" className="hover:text-foreground">Sign up</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
              <li><Link href="/dashboard/settings" className="hover:text-foreground">Settings</Link></li>
              <li><Link href="/support" className="hover:text-foreground">Support</Link></li>
            </ul>
          </div>
          <div suppressHydrationWarning>
            <h4 className="font-semibold mb-3">Contact</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/#contact" className="hover:text-foreground">Feedback</Link></li>
              <li>Verified sources only</li>
              <li>No financial advice</li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-gray-200 pt-6 text-center text-xs text-muted-foreground transition-colors dark:border-white/10 lg:pr-44" suppressHydrationWarning style={{ paddingRight: "0px" }}>
          &copy; {new Date().getFullYear()} TRADX. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
