import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { isMaintenanceModeEnabled } from "@/lib/settings";

const BYPASS_PREFIXES = ["/admin", "/login", "/register", "/maintenance", "/api"];

export async function enforceMaintenanceMode() {
  const enabled = await isMaintenanceModeEnabled();
  if (!enabled) return;

  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";

  const bypassed = BYPASS_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (!bypassed) {
    redirect("/maintenance");
  }
}
