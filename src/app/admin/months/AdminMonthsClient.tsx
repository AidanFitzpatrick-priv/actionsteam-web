"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLiveSync } from "@/hooks/useLiveSync";

type Month = { id: string; name: string; slug: string; isActive: boolean; archivedAt: string | null };

export function AdminMonthsClient() {
  const [months, setMonths] = useState<Month[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [deleteSlug, setDeleteSlug] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/months");
    const data = await res.json();
    if (res.ok) setMonths(data.months);
  }, []);

  useEffect(() => { load(); }, [load]);

  useLiveSync({
    admin: true,
    onEvent: ev => {
      if (ev.type === "admin.updated") load();
    }
  });

  async function createMonth(e: FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/months", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name })
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Failed"); return; }
    setName("");
    await load();
  }

  async function action(slug: string, actionName: "activate" | "archive" | "hard_delete", reason?: string) {
    await fetch(`/api/admin/months/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: actionName, reason })
    });
    await load();
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Create month</h2>
        <form onSubmit={createMonth} className="grid-2">
          <div className="field">
            <label htmlFor="month-name">Month name</label>
            <input id="month-name" className="input" value={name} onChange={e => setName(e.target.value)} placeholder="June" />
          </div>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="btn">Create</button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2>All months</h2>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {months.map(m => (
              <tr key={m.id}>
                <td>{m.name}{m.isActive && " (active)"}</td>
                <td>{m.archivedAt ? "Archived" : "Active list"}</td>
                <td style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!m.archivedAt && !m.isActive && (
                    <button type="button" className="btn btn-secondary" onClick={() => action(m.slug, "activate")}>Set active</button>
                  )}
                  {!m.archivedAt && (
                    <button type="button" className="btn btn-secondary" onClick={() => action(m.slug, "archive")}>Archive</button>
                  )}
                  <button type="button" className="btn btn-danger" onClick={() => setDeleteSlug(m.slug)}>Hard delete…</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteSlug && (
        <div className="card" style={{ marginTop: 16, borderColor: "var(--danger)" }}>
          <h2>Confirm hard delete</h2>
          <p className="muted">Type a reason. This permanently removes the month and all schedule/tracker data.</p>
          <div className="field">
            <label htmlFor="delete-reason">Reason</label>
            <input id="delete-reason" className="input" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-danger" onClick={() => { action(deleteSlug!, "hard_delete", deleteReason); setDeleteSlug(null); setDeleteReason(""); }}>DELETE permanently</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDeleteSlug(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
