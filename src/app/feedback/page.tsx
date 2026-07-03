import Link from "next/link";
import { FeedbackForm } from "@/components/feedback/feedback-form";

export const metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-4xl items-center px-4 py-10 sm:px-6">
      <div className="grid w-full gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-3xl border border-border bg-card/95 p-6 shadow-[0_24px_70px_rgba(0,0,0,0.16)]">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            Back to landing page
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-foreground">Send Feedback</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Tell us what feels broken, slow, unclear, or worth improving. Admins are notified immediately and can reply from the feedback inbox.
          </p>
          <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-200">
            Feedback, bugs, and suggestions are routed directly to the admin panel.
          </div>
        </section>
        <FeedbackForm />
      </div>
    </div>
  );
}
