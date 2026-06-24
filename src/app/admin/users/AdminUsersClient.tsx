"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { allowedRoleOptionsForActor, canDeleteUser, canEditUserRole, canEditUsername, canManageGoalTrackerVisibility, formatRole } from "@/lib/rbac";
import { useLiveSync } from "@/hooks/useLiveSync";

type UserRow = {
  id: string;
  username: string;
  email: string;
  cityId: string | null;
  discordId: string | null;
  role: UserRole;
  hiddenFromGoalTrackers?: boolean;
};

export function AdminUsersClient({
  viewerRole,
  viewerUserId
}: {
  viewerRole: UserRole;
  viewerUserId: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usernameDraft, setUsernameDraft] = useState<Record<string, string>>({});
  const [cityDraft, setCityDraft] = useState<Record<string, string>>({});
  const [discordDraft, setDiscordDraft] = useState<Record<string, string>>({});
  const assignableRoles = allowedRoleOptionsForActor(viewerRole);
  const canEditNames = canEditUsername(viewerRole);
  const canManageGoalVisibility = canManageGoalTrackerVisibility(viewerRole);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      setUsers(data.users);
      setUsernameDraft(prev => {
        const next = { ...prev };
        for (const u of data.users as UserRow[]) {
          if (next[u.id] === undefined) next[u.id] = u.username;
        }
        return next;
      });
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
    patch: { role?: UserRole; username?: string; cityId?: string | null; discordId?: string | null; hiddenFromGoalTrackers?: boolean }
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

  async function removeUser(user: UserRow) {
    if (!confirm(`Permanently delete ${user.username}? This cannot be undone.`)) return;
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Delete failed");
    }
    await load();
  }

  async function saveUsername(userId: string) {
    const raw = usernameDraft[userId]?.trim();
    if (!raw) return;
    await patch(userId, { username: raw });
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
            {canManageGoalVisibility && <th>Goal trackers</th>}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => {
            const canEditRole = canEditUserRole(viewerRole, u.role);
            const canRemove = u.id !== viewerUserId && canDeleteUser(viewerRole, u.role);
            const roleOptions = canEditRole
              ? assignableRoles.includes(u.role)
                ? assignableRoles
                : [u.role, ...assignableRoles.filter(r => r !== u.role)]
              : [];

            return (
              <tr key={u.id}>
                <td>
                  {canEditNames ? (
                    <input
                      className="input"
                      style={{ maxWidth: 140, padding: "4px 8px", fontSize: 13 }}
                      value={usernameDraft[u.id] ?? ""}
                      placeholder="Username"
                      onChange={e => setUsernameDraft(d => ({ ...d, [u.id]: e.target.value }))}
                      onBlur={() => saveUsername(u.id)}
                    />
                  ) : (
                    u.username
                  )}
                </td>
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
                {canManageGoalVisibility && (
                  <td>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        checked={Boolean(u.hiddenFromGoalTrackers)}
                        onChange={e =>
                          patch(u.id, { hiddenFromGoalTrackers: e.target.checked })
                        }
                      />
                      Hide from goals
                    </label>
                    {u.hiddenFromGoalTrackers && (
                      <span className="badge" style={{ marginTop: 4, display: "inline-block" }}>
                        Hidden from goals
                      </span>
                    )}
                  </td>
                )}
                <td>
                  {canRemove && (
                    <button type="button" className="btn btn-danger" onClick={() => removeUser(u)}>
                      Delete
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
