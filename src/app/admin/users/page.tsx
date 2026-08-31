import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin, isProtectedAdminAccount } from "@/lib/rbac";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const admin = isFullAdmin(user.role);
  const isAdminAccount = isProtectedAdminAccount(user.username);

  return (
    <div className="container-users">
      <h1>{admin ? "Users" : "Your account"}</h1>
      <p className="muted">
        {admin ? (
          <>
            Create users without a password — they set one the first time they sign in. Edit usernames, roles, orgs, and city IDs, reset passwords, or permanently delete users below your rank. You cannot delete yourself or reset your own password here.
            Only management can assign management.
            {isAdminAccount && " You can also delete, reset passwords, and change roles for other management members."}
          </>
        ) : (
          <>View your account details and org assignment (Gang or PD). Contact an aux+ if anything looks wrong.</>
        )}
      </p>
      <AdminUsersClient viewerRole={user.role} viewerUserId={user.id} viewerUsername={user.username} />
    </div>
  );
}
