"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { canViewAllInvites } from "@/lib/rbac";
import { useLiveSync } from "@/hooks/useLiveSync";
import type { UserRole } from "@prisma/client";

type InviteRow = {
  id: string;
  createdBy: { username: string; role: UserRole };
  createdAt: string;
  expiresAt: string;
  status: string;
  usedBy: { username: string; at: string } | null;
};

export function InvitesAdminClient({ viewerRole }: { viewerRole: UserRole }) {
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLink, setNewLink] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/invites");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to load invites");
      setLoading(false);
      return;
    }
    setInvites(data.invites);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useLiveSync({
    invites: true,
    onEvent: ev => {
      if (ev.type === "invites.updated") load();
    }
  });

  async function createInvite(e: FormEvent) {
    e.preventDefault();
    setError("");
    setNewLink("");
    const res = await fetch("/api/invites", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create invite");
      return;
    }
    setNewLink(data.invite.signupLink);
    await load();
  }

  async function revoke(id: string) {
    await fetch(`/api/invites/${id}?action=revoke`, { method: "POST" });
    await load();
  }

  async function regenerate(id: string) {
    setNewLink("");
    const res = await fetch(`/api/invites/${id}?action=regenerate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) setNewLink(data.invite.signupLink);
    await load();
  }

  function badgeClass(status: string) {
    return `badge badge-${status}`;
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: 24 }}>
        <h2>Create invite link</h2>
        <p className="muted">
          {canViewAllInvites(viewerRole)
            ? "You see all team invites (aux+). New sign-ups are always members."
            : "You see invites you created. New sign-ups are always members."}
        </p>
        <form onSubmit={createInvite} style={{ marginTop: 16 }}>
          <button type="submit" className="btn">Create invite link</button>
        </form>
        {newLink && (
          <div style={{ marginTop: 16 }}>
            <p className="success">Copy this link now — it won&apos;t be shown again:</p>
            <input className="input" readOnly value={newLink} onFocus={e => e.target.select()} />
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2>Invite history</h2>
        {loading ? (
          <p className="muted">Loading…</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Created by</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Used by</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id}>
                  <td>{inv.createdBy.username} <span className="muted">({inv.createdBy.role.replace("_", " ")})</span></td>
                  <td>{new Date(inv.createdAt).toLocaleDateString("en-GB")}</td>
                  <td>{new Date(inv.expiresAt).toLocaleDateString("en-GB")}</td>
                  <td><span className={badgeClass(inv.status)}>{inv.status}</span></td>
                  <td>{inv.usedBy ? `${inv.usedBy.username} (${new Date(inv.usedBy.at).toLocaleDateString("en-GB")})` : "—"}</td>
                  <td>
                    {inv.status === "pending" && (
                      <>
                        <button type="button" className="btn btn-secondary" style={{ padding: "4px 8px", fontSize: 12, marginRight: 4 }} onClick={() => regenerate(inv.id)}>Regenerate</button>
                        <button type="button" className="btn btn-danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => revoke(inv.id)}>Revoke</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!invites.length && (
                <tr><td colSpan={6} className="muted">No invites yet.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
