"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { allowedRoleOptionsForActor, canEditUserRole, formatRole } from "@/lib/rbac";
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

export function AdminUsersClient({ viewerRole }: { viewerRole: UserRole }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [cityDraft, setCityDraft] = useState<Record<string, string>>({});
  const [discordDraft, setDiscordDraft] = useState<Record<string, string>>({});
  const assignableRoles = allowedRoleOptionsForActor(viewerRole);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users);
      setCityDraft(prev => {
        const next = { ...prev };
        for (const u of data.users as UserRow[]) {
          if (next[u.id] === undefined) next[u.id] = u.cityId ?? "";
        }
        return next;
      });
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

  async function patch(
    userId: string,
    patch: { role?: UserRole; disabled?: boolean; cityId?: string | null; discordId?: string | null }
  ) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Update failed");
    }
    await load();
  }

  async function saveCityId(userId: string) {
    const raw = cityDraft[userId]?.trim();
    await patch(userId, { cityId: raw || null });
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
          {users.map(u => {
            const canEditRole = canEditUserRole(viewerRole, u.role);
            const roleOptions = canEditRole
              ? assignableRoles.includes(u.role)
                ? assignableRoles
                : [u.role, ...assignableRoles.filter(r => r !== u.role)]
              : [];

            return (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.email}</td>
                <td>
                  <input
                    className="input"
                    style={{ maxWidth: 140, padding: "4px 8px", fontSize: 13 }}
                    value={cityDraft[u.id] ?? ""}
                    placeholder="City ID"
                    onChange={e => setCityDraft(d => ({ ...d, [u.id]: e.target.value }))}
                    onBlur={() => saveCityId(u.id)}
                  />
                </td>
                <td>
                  <input
                    className="input"
                    style={{ maxWidth: 180, padding: "4px 8px", fontSize: 13 }}
                    value={discordDraft[u.id] ?? ""}
                    placeholder="17–20 digits"
                    onChange={e => setDiscordDraft(d => ({ ...d, [u.id]: e.target.value }))}
                    onBlur={() => saveDiscord(u.id)}
                  />
                </td>
                <td>
                  {canEditRole ? (
                    <select
                      className="select"
                      value={u.role}
                      onChange={e => patch(u.id, { role: e.target.value as UserRole })}
                    >
                      {roleOptions.map(r => (
                        <option key={r} value={r}>{formatRole(r)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="muted">{formatRole(u.role)}</span>
                  )}
                </td>
                <td>{u.disabledAt ? "Disabled" : "Active"}</td>
                <td>
                  <button type="button" className="btn btn-secondary" onClick={() => patch(u.id, { disabled: !u.disabledAt })}>
                    {u.disabledAt ? "Enable" : "Disable"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
