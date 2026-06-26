import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin-guard";
import { PuterTokenManager } from "@/components/admin/puter-token-manager";

export const metadata = { title: "AI Assistant Tokens" };

export default async function AdminAIPage() {
  await requireAdminPage();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Puter Token Management</h1>
          <p className="text-sm text-muted-foreground">
            Store multiple Puter tokens for the AI assistant. Users never see a Puter login prompt.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-primary hover:underline">
          Back to dashboard
        </Link>
      </div>

      <PuterTokenManager />
    </div>
  );
}
