import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canCreateInvites, isFullAdmin, formatRole } from "@/lib/rbac";
import { LogoutButton } from "@/components/LogoutButton";

export async function Nav() {
  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    // DB may still be syncing on cold start — render logged-out nav
  }

  return (
    <header className="nav">
      <Link href="/" style={{ fontWeight: 700, color: "var(--text)", textDecoration: "none" }}>
        Actions Tracker
      </Link>
      <nav className="nav-links">
        {user ? (
          <>
            <span className="muted">{user.username} · {formatRole(user.role)}</span>
            {canCreateInvites(user.role) && <Link href="/admin/invites">Invites</Link>}
            {isFullAdmin(user.role) && (
              <>
                <Link href="/admin/months">Months</Link>
                <Link href="/admin/data">Data</Link>
                <Link href="/admin/users">Users</Link>
                <Link href="/admin/tools">Tools</Link>
                <Link href="/admin/backups">Backups</Link>
                <Link href="/admin/audit">Audit</Link>
              </>
            )}
            <Link href="/stats">Stats</Link>
            <LogoutButton />
          </>
        ) : (
          <>
            <Link href="/login">Log in</Link>
          </>
        )}
      </nav>
    </header>
  );
}
