import { SupportChat } from "@/components/support/support-chat";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata = { title: "Support" };

export default async function SupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold gradient-text">Support</h1>
        <p className="text-sm text-muted-foreground mt-1">Chat with our team in real time</p>
      </div>
      <SupportChat />
    </div>
  );
}
