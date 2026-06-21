import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";

export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    redirect("/");
  }
  return user;
}
