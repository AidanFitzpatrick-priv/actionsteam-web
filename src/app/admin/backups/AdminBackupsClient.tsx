"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { canRestoreProduction } from "@/lib/rbac";

type Backup = { id: string; createdAt: string; storageKey: string; sizeBytes: string | null; kind: string; createdBy: string };

export function AdminBackupsClient({ viewerRole }: { viewerRole: UserRole }) {
  const [backups, setBackups] = useState<Backup[]>([]);
  const canRestore = canRestoreProduction(viewerRole);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/backups");
    const data = await res.json();
    if (res.ok) setBackups(data.backups);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runBackup() {
    await fetch("/api/admin/backups", { method: "POST" });
    await load();
  }

  async function restore(id: string) {
    if (!confirm("Restore this backup? Management-only for production.")) return;
    await fetch(`/api/admin/backups/${id}/restore`, { method: "POST" });
    await load();
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <button type="button" className="btn" onClick={runBackup}>Run manual backup</button>
        {!canRestore && <p className="muted" style={{ marginTop: 12 }}>Restore is limited to management.</p>}
      </div>
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Created</th><th>Key</th><th>Size</th><th>Kind</th><th>By</th><th /></tr>
          </thead>
          <tbody>
            {backups.map(b => (
              <tr key={b.id}>
                <td>{new Date(b.createdAt).toLocaleString("en-GB")}</td>
                <td>{b.storageKey}</td>
                <td>{b.sizeBytes ?? "—"}</td>
                <td>{b.kind}</td>
                <td>{b.createdBy}</td>
                <td>{canRestore && <button type="button" className="btn btn-secondary" onClick={() => restore(b.id)}>Restore</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
