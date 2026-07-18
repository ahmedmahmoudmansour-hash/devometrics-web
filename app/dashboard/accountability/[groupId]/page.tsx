import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccountabilityGroupDetail } from "@/lib/accountability/actions";
import AccountabilityGroupDetail from "@/components/dashboard/AccountabilityGroupDetail";

export const metadata = { title: "Accountability Group — Devometrics" };

export default async function AccountabilityGroupPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { group, members, checkins, isCreator } = await getAccountabilityGroupDetail(groupId);
  if (!group) notFound();

  return (
    <div style={{ minHeight: "100vh", padding: "48px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/dashboard/accountability" style={{ color: "var(--teal)", fontSize: 14, textDecoration: "none" }}>
            ← All groups
          </Link>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text)", marginTop: 4 }}>{group.name}</h1>
          {group.description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>{group.description}</p>}
        </div>

        <AccountabilityGroupDetail group={group} members={members} checkins={checkins} isCreator={isCreator} currentUserId={user.id} />
      </div>
    </div>
  );
}
