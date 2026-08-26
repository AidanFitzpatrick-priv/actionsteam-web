import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canCreateInvites } from "@/lib/rbac";
import { InvitesAdminClient } from "./InvitesAdminClient";

export default async function AdminInvitesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canCreateInvites(user.role)) redirect("/");

  return (
    <div className="container-wide">
      <h1>Invite members</h1>
      <div style={{ marginTop: 24 }}>
        <InvitesAdminClient />
      </div>
    </div>
  );
}
