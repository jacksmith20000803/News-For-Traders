import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { canAccessAdmin } from "@/lib/auth/permissions";
import { ApiError } from "@/lib/api/response";

export async function requireAdminPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    redirect("/");
  }
  return user;
}

export async function requireAdminApi() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user.role)) {
    throw new ApiError(403, "Administrator access required", "FORBIDDEN");
  }
  return user;
}
