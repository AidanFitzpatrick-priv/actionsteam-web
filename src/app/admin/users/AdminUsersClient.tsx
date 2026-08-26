"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { UserOrg, UserRole } from "@prisma/client";
import {
  ADMIN_USER_ROLE_GROUPS,
  allowedRoleOptionsForActor,
  canDeleteUser,
  canEditUserRole,
  canEditUsername,
  canResetUserPassword,
  formatRole,
  isFullAdmin,
  isProtectedAdminAccount
} from "@/lib/rbac";
import { useLiveSync } from "@/hooks/useLiveSync";

type UserRow = {
  id: string;
  username: string;
  cityId: string | null;
  role: UserRole;
  org: UserOrg | null;
  mustResetPassword?: boolean;
};

function formatOrg(org: UserOrg | null): string {
  if (org === "gang") return "Gang";
  if (org === "pd") return "PD";
  return "—";
}

export function AdminUsersClient({
  viewerRole,
  viewerUserId,
  viewerUsername
}: {
  viewerRole: UserRole;
  viewerUserId: string;
  viewerUsername: string;
}) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [usernameDraft, setUsernameDraft] = useState<Record<string, string>>({});
  const [cityDraft, setCityDraft] = useState<Record<string, string>>({});
  const assignableRoles = allowedRoleOptionsForActor(viewerRole);
  const canManageUsers = isFullAdmin(viewerRole);
  const canEditNames = canManageUsers && canEditUsername(viewerRole);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) {
      const listed = (data.users as UserRow[]).filter(u => !isProtectedAdminAccount(u.username));
      setUsers(listed);
      setUsernameDraft(prev => {
        const next = { ...prev };
        for (const u of listed) {
          if (next[u.id] === undefined) next[u.id] = u.username;
        }
        return next;
      });
      setCityDraft(prev => {
        const next = { ...prev };
        for (const u of listed) {
          if (next[u.id] === undefined) next[u.id] = u.cityId ?? "";
        }
        return next;
      });
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useLiveSync({
    admin: canManageUsers,
    onEvent: ev => {
      if (ev.type === "admin.updated") load();
    }
  });

  async function patch(
    userId: string,
    patch: {
      role?: UserRole;
      username?: string;
      cityId?: string | null;
      org?: UserOrg | null;
    }
  ) {
    if (!canManageUsers) return;
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
    if (!canManageUsers) return;
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

  async function resetPassword(user: UserRow) {
    if (!canManageUsers) return;
    if (
      !confirm(
        `Force ${user.username} to set a new password on next login? They will be signed out immediately.`
      )
    ) {
      return;
    }
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action: "resetPassword" })
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? "Password reset failed");
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

  const groupedUsers = useMemo(() => {
    if (!canManageUsers) {
      return [{ label: "Your account", users }];
    }
    return ADMIN_USER_ROLE_GROUPS.map(g => ({
      label: g.label,
      users: users
        .filter(u => u.role === g.role)
        .sort((a, b) => a.username.localeCompare(b.username, undefined, { sensitivity: "base" }))
    })).filter(g => g.users.length > 0);
  }, [users, canManageUsers]);

  const colCount = canManageUsers ? 5 : 4;

  function renderUserRow(u: UserRow) {
    const canEditRole =
      canManageUsers && canEditUserRole(viewerRole, u.role, u.username, viewerUsername);
    const canRemove =
      canManageUsers &&
      u.id !== viewerUserId &&
      canDeleteUser(viewerRole, u.role, u.username, viewerUsername);
    const canReset =
      canManageUsers &&
      u.id !== viewerUserId &&
      canResetUserPassword(viewerRole, u.role, u.username, viewerUsername);
    const roleOptions = canEditRole
      ? assignableRoles.includes(u.role)
        ? assignableRoles
        : [u.role, ...assignableRoles.filter(r => r !== u.role)]
      : [];

    return (
      <tr key={u.id}>
        <td>
          {canEditNames && !isProtectedAdminAccount(u.username) ? (
            <input
              className="input field-fill"
              value={usernameDraft[u.id] ?? ""}
              placeholder="Username"
              onChange={e => setUsernameDraft(d => ({ ...d, [u.id]: e.target.value }))}
              onBlur={() => saveUsername(u.id)}
            />
          ) : (
            u.username
          )}
          {u.mustResetPassword && (
            <span className="badge" style={{ marginTop: 4, display: "inline-block" }}>
              Must change password
            </span>
          )}
        </td>
        <td>
          {canManageUsers ? (
            <input
              className="input field-fill"
              value={cityDraft[u.id] ?? ""}
              placeholder="City ID"
              onChange={e => setCityDraft(d => ({ ...d, [u.id]: e.target.value }))}
              onBlur={() => saveCityId(u.id)}
            />
          ) : (
            u.cityId || "—"
          )}
        </td>
        <td>
          {canEditRole ? (
            <select
              className="select field-fill"
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
        <td>
          {canManageUsers ? (
            <select
              className="select field-fill"
              value={u.org ?? ""}
              onChange={e => {
                const value = e.target.value;
                patch(u.id, { org: value === "" ? null : (value as UserOrg) });
              }}
            >
              <option value="">—</option>
              <option value="gang">Gang</option>
              <option value="pd">PD</option>
            </select>
          ) : (
            formatOrg(u.org)
          )}
        </td>
        {canManageUsers && (
          <td className="actions-cell">
            {canReset && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => resetPassword(u)}
              >
                Reset password
              </button>
            )}
            {canRemove && (
              <button type="button" className="btn btn-danger" onClick={() => removeUser(u)}>
                Delete
              </button>
            )}
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="card">
      <table className="table admin-users-table">
        <thead>
          <tr>
            <th className="col-username">Username</th>
            <th className="col-city">City ID</th>
            <th className="col-role">Role</th>
            <th className="col-org">Org</th>
            {canManageUsers && <th className="col-actions">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {groupedUsers.map(group => (
            <Fragment key={group.label}>
              <tr className="goal-group-heading">
                <td colSpan={colCount}>{group.label}</td>
              </tr>
              {group.users.map(renderUserRow)}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
