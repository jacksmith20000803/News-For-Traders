import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/admin-guard";
import { db } from "@/lib/db";
import { AdminFeedbackManagement } from "@/components/admin/admin-feedback-management";

export const metadata = { title: "Feedback Inbox" };

export default async function AdminFeedbackPage() {
  await requireAdminPage();

  const limit = 12;
  const [items, total] = await Promise.all([
    db.feedbackSubmission.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { id: true, name: true, email: true, avatar: true, username: true } } },
    }),
    db.feedbackSubmission.count(),
  ]);

  const serializedItems = items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    repliedAt: item.repliedAt?.toISOString() ?? null,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Feedback Inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Reply to users, delete handled feedback, and track all admin actions.
          </p>
        </div>
        <Link href="/admin" className="inline-flex rounded-2xl border border-border bg-card/95 px-4 py-2 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary hover:text-primary-foreground">
          Back to Dashboard
        </Link>
      </div>

      <AdminFeedbackManagement
        initialData={{
          items: serializedItems,
          pagination: {
            page: 1,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        }}
      />
    </div>
  );
}
