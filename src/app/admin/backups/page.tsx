import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canViewBackups } from "@/lib/rbac";
import { AdminBackupsClient } from "./AdminBackupsClient";

export default async function AdminBackupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewBackups(user.username)) redirect("/");

  return (
    <div className="container-wide">
      <h1>Backups</h1>
      <p className="muted">
        Automatic backup every 12 hours; up to 4 retained (48h). Only the admin account can access this page.
      </p>
      <AdminBackupsClient viewerRole={user.role} />
    </div>
  );
}
