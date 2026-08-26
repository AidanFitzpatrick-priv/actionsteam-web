import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { isFullAdmin } from "@/lib/rbac";
import { listRecentAuditLogView } from "@/lib/audit";

export default async function AdminAuditPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isFullAdmin(user.role)) redirect("/");

  const logs = await listRecentAuditLogView(50);

  return (
    <div className="container-wide">
      <h1>Audit log</h1>
      <p className="muted">Last 50 events, in plain English.</p>
      <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What happened</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td>{log.createdAt.toLocaleString("en-GB")}</td>
                <td>{log.who}</td>
                <td>
                  <div className="audit-what">{log.what}</div>
                  {log.details ? <div className="audit-details">{log.details}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
