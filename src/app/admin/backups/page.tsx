import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canViewBackups } from "@/lib/rbac";
import { AdminBackupsClient } from "./AdminBackupsClient";

export default async function AdminBackupsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canViewBackups(user.role)) redirect("/");

  return (
    <div className="container-wide">
      <h1>Backups</h1>
      <p className="muted">
        Automatic backup every 12 hours; up to 4 retained (48h). Restore is management-only.
      </p>
      <AdminBackupsClient viewerRole={user.role} />
    </div>
  );
}
