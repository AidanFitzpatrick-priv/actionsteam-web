import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin } from "@/lib/rbac";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = isFullAdmin(user.role);

  return (
    <div className="container-users">
      <h1>{admin ? "Users" : "Your account"}</h1>
      <p className="muted">
        {admin ? (
          <>
            Edit usernames, roles, orgs, and IDs, reset passwords, or permanently delete users below your rank. You cannot delete yourself or reset your own password here.
            Only management can assign management.
          </>
        ) : (
          <>View your account details and org assignment (Gang or PD). Contact an aux+ if anything looks wrong.</>
        )}
      </p>
      <AdminUsersClient viewerRole={user.role} viewerUserId={user.id} />
    </div>
  );
}
