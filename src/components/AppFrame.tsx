import { getCurrentUser } from "@/lib/session";
import { canCreateInvites, canViewBackups, isFullAdmin, formatRole } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { AppShell, type AppShellLink } from "@/components/AppShell";

export async function AppFrame({ children }: { children: React.ReactNode }) {
  let user = null;
  let activeMonthSlug: string | null = null;

  try {
    user = await getCurrentUser();
    if (user) {
      const month = await prisma.month.findFirst({
        where: { isActive: true, archivedAt: null },
        orderBy: { createdAt: "desc" },
        select: { slug: true }
      });
      activeMonthSlug = month?.slug ?? null;
    }
  } catch {
    // DB may still be syncing on cold start
  }

  if (!user) return children;

  const links: AppShellLink[] = [];
  if (activeMonthSlug) {
    links.push(
      { href: `/months/${activeMonthSlug}/schedule`, label: "Schedule", match: "prefix" },
      { href: `/months/${activeMonthSlug}/tracker`, label: "Tracker", match: "prefix" },
      { href: `/months/${activeMonthSlug}/br-tracker`, label: "BR Tracker", match: "prefix" }
    );
  }
  links.push(
    { href: "/action-log", label: "Action log", match: "prefix" },
    { href: "/stats", label: "Stats", match: "prefix" },
    { href: "/leaderboard", label: "Leaderboard", match: "prefix" },
    { href: "/goals/actions", label: "Action goals", match: "prefix" },
    { href: "/admin/users", label: "Users", match: "prefix" }
  );
  if (canCreateInvites(user.role)) {
    links.push({ href: "/admin/invites", label: "Invites", match: "prefix" });
  }
  if (isFullAdmin(user.role)) {
    links.push(
      { href: "/admin/months", label: "Months", match: "prefix" },
      { href: "/admin/data", label: "Types & gangs", match: "prefix" },
      { href: "/admin/audit", label: "Audit", match: "prefix" }
    );
  }
  if (canViewBackups(user.username)) {
    links.push({ href: "/admin/backups", label: "Backups", match: "prefix" });
  }

  return (
    <AppShell
      username={user.username}
      roleLabel={formatRole(user.role)}
      avatarUpdatedAt={user.avatarUpdatedAt?.toISOString() ?? null}
      links={links}
    >
      {children}
    </AppShell>
  );
}
