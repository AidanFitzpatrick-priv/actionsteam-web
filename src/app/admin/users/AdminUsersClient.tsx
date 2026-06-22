"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { formatRole } from "@/lib/rbac";
import { useLiveSync } from "@/hooks/useLiveSync";

type UserRow = {
  id: string;
  username: string;
  email: string;
  cityId: string | null;
  discordId: string | null;
  role: UserRole;
  disabledAt: string | null;
};

const ROLES: UserRole[] = ["member", "sub_lead", "lead", "aux", "adm", "management"];

export function AdminUsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [discordDraft, setDiscordDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users);
      setDiscordDraft(prev => {
        const next = { ...prev };
        for (const u of data.users as UserRow[]) {
          if (next[u.id] === undefined) next[u.id] = u.discordId ?? "";
        }
        return next;
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useLiveSync({
    admin: true,
    onEvent: ev => {
      if (ev.type === "admin.updated") load();
    }
  });

  async function patch(userId: string, patch: { role?: UserRole; disabled?: boolean; discordId?: string | null }) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch })
    });
    await load();
  }

  async function saveDiscord(userId: string) {
    const raw = discordDraft[userId]?.trim();
    await patch(userId, { discordId: raw || null });
  }

  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>City ID</th>
            <th>Discord ID</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
              <td className="muted">{u.cityId ?? "—"}</td>
              <td>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <input
                    className="input"
                    style={{ maxWidth: 180, padding: "4px 8px", fontSize: 13 }}
                    value={discordDraft[u.id] ?? ""}
                    placeholder="17–20 digits"
                    onChange={e => setDiscordDraft(d => ({ ...d, [u.id]: e.target.value }))}
                    onBlur={() => saveDiscord(u.id)}
                  />
                </div>
              </td>
              <td>
                <select
                  className="select"
                  value={u.role}
                  onChange={e => patch(u.id, { role: e.target.value as UserRole })}
                >
                  {ROLES.map(r => <option key={r} value={r}>{formatRole(r)}</option>)}
                </select>
              </td>
              <td>{u.disabledAt ? "Disabled" : "Active"}</td>
              <td>
                <button type="button" className="btn btn-secondary" onClick={() => patch(u.id, { disabled: !u.disabledAt })}>
                  {u.disabledAt ? "Enable" : "Disable"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
