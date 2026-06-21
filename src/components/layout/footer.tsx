import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <h4 className="font-semibold mb-3">MarketPulse</h4>
            <p className="text-sm text-muted-foreground">
              Reliable market intelligence for professional traders. Accuracy over quantity.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Platform</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/" className="hover:text-foreground">Dashboard</Link></li>
              <li><Link href="/ai" className="hover:text-foreground">AI Assistant</Link></li>
              <li><Link href="/knowledge" className="hover:text-foreground">Knowledge Plaza</Link></li>
              <li><Link href="/community" className="hover:text-foreground">Community</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Account</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/register" className="hover:text-foreground">Sign up</Link></li>
              <li><Link href="/login" className="hover:text-foreground">Sign in</Link></li>
              <li><Link href="/dashboard/settings" className="hover:text-foreground">Settings</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-3">Trust</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Verified sources only</li>
              <li>Transparent reliability scores</li>
              <li>No financial advice</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} MarketPulse. Built for reliability and trust.
        </div>
      </div>
    </footer>
  );
}
