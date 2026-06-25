import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export default async function AdminAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isFullAdmin(user.role)) redirect("/");

  const logs = await prisma.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true } } }
  });

  return (
    <div className="container-wide">
      <h1>Audit log</h1>
      <p className="muted">Last 50 events.</p>
      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr><th>When</th><th>User</th><th>Action</th><th>Entity</th></tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleString("en-GB")}</td>
                <td>{l.user?.username ?? "—"}</td>
                <td>{l.action}</td>
                <td>{l.entityType ? `${l.entityType}${l.entityId ? ` #${l.entityId.slice(0, 8)}` : ""}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
