import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canCreateInvites, canViewBackups, isFullAdmin, formatRole } from "@/lib/rbac";
import { LogoutButton } from "@/components/LogoutButton";
import { prisma } from "@/lib/db";

export async function Nav() {
  let user = null;
  let activeMonth: { slug: string } | null = null;

  try {
    user = await getCurrentUser();
    if (user) {
      activeMonth = await prisma.month.findFirst({
        where: { isActive: true, archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { slug: true }
      });
    }
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
            {activeMonth && (
              <>
                <Link href={`/months/${activeMonth.slug}/schedule`}>Schedule</Link>
                <Link href={`/months/${activeMonth.slug}/tracker`}>Tracker</Link>
              </>
            )}
            <Link href="/stats">Stats</Link>
            <Link href="/goals/actions">Action goals</Link>
            <Link href="/goals/bookings">Booking goals</Link>
            {canCreateInvites(user.role) && <Link href="/admin/invites">Invites</Link>}
            {isFullAdmin(user.role) && (
              <>
                <Link href="/admin/months">Months</Link>
                <Link href="/admin/data">Action types</Link>
                <Link href="/admin/users">Users</Link>
                <Link href="/admin/tools">Tools</Link>
                <Link href="/admin/audit">Audit</Link>
              </>
            )}
            {canViewBackups(user.role) && <Link href="/admin/backups">Backups</Link>}
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
