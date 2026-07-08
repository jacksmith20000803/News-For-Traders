import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getCommunityHubData } from "@/lib/community/hub-data";
import { CommunityHub } from "@/components/community/community-hub";

export const metadata = { title: "Community" };

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ community?: string; dm?: string }>;
}) {
  await connection();
  const user = await getCurrentUser();
  const query = await searchParams;

  if (!user) {
    redirect("/login?returnTo=/community");
  }

  const initialData = await getCommunityHubData(user.id);

  return (
    <div className="auth-market-bg min-h-[calc(100vh-8rem)] px-0 py-0 lg:px-4 lg:py-5">
      <div className="relative z-10">
        <CommunityHub
          currentUser={{
            id: user.id,
            name: user.name,
            username: user.username,
            email: user.email,
            avatar: user.avatar,
            country: null,
          }}
          initialData={initialData}
          initialTarget={
            query.community
              ? { kind: "community", id: query.community }
              : query.dm
                ? { kind: "dm", id: query.dm }
                : undefined
          }
        />
      </div>
    </div>
  );
}
