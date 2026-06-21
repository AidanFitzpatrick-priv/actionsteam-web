"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserRole } from "@prisma/client";
import { formatRole } from "@/lib/rbac";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  disabledAt: string | null;
};

const ROLES: UserRole[] = ["member", "sub_lead", "lead", "aux", "adm", "management"];

export function AdminUsersClient() {
  const [users, setUsers] = useState<UserRow[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    if (res.ok) setUsers(data.users);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function patch(userId: string, patch: { role?: UserRole; disabled?: boolean }) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...patch })
    });
    await load();
  }

  return (
    <div className="card">
      <table className="table">
        <thead>
          <tr><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.username}</td>
              <td>{u.email}</td>
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
