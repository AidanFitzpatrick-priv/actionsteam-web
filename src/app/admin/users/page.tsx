import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin } from "@/lib/rbac";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isFullAdmin(user.role)) redirect("/");

  return (
    <div className="container-wide">
      <h1>Users</h1>
      <p className="muted">
        Disable accounts, edit usernames, or change roles. You can only change roles for users below your rank.
        Only management can assign management.
      </p>
      <AdminUsersClient viewerRole={user.role} />
    </div>
  );
}
