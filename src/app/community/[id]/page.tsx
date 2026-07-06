import { redirect } from "next/navigation";

export default async function CommunityRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/community?community=${encodeURIComponent(id)}`);
}
