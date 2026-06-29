import { requireAdminPage } from "@/lib/auth/admin-guard";
import { AdminUserDetail } from "@/components/admin/admin-user-detail";

export const metadata = { title: "User Detail" };

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
};

export default async function AdminUserDetailPage({ params, searchParams }: PageProps) {
  await requireAdminPage();
  const { id } = await params;
  const { kind } = await searchParams;

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <AdminUserDetail id={id} kind={kind === "visitor" ? "visitor" : "user"} />
    </div>
  );
}
