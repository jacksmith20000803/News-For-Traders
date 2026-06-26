import Link from "next/link";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card" suppressHydrationWarning>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" suppressHydrationWarning>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" suppressHydrationWarning>
          <div suppressHydrationWarning>
            <Image
              src="/tradx-logo.png"
              alt="TRADX"
              width={200}
              height={60}
              className="mb-3 h-14 w-auto object-contain object-left"
              style={{ width: "auto" }}
            />
            <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground mb-2">
              Trade. Invest. Grow.
            </p>
            <p className="text-sm text-muted-foreground">
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
        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground" suppressHydrationWarning>
          © {new Date().getFullYear()} TRADX. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
