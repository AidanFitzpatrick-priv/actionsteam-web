import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canCreateInvites, isFullAdmin } from "@/lib/rbac";
import { prisma } from "@/lib/db";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const activeMonth = await prisma.month.findFirst({
    where: { isActive: true, archivedAt: null },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="container-wide">
      <h1>Welcome, {user.username}</h1>
      <p className="muted">Actions schedule, tracker, stats, and goal scores.</p>

      <div className="grid-2" style={{ marginTop: 24 }}>
        <div className="card">
          <h2>Schedule &amp; Tracker</h2>
          {activeMonth ? (
            <>
              <p>Active month: <strong>{activeMonth.name}</strong></p>
              <p className="muted" style={{ marginTop: 12 }}>
                Edit the schedule and tracker for the active month.
              </p>
              <p style={{ marginTop: 12 }}>
                <Link href={`/months/${activeMonth.slug}/schedule`}>Open schedule</Link>
                {" · "}
                <Link href={`/months/${activeMonth.slug}/tracker`}>Open tracker</Link>
              </p>
            </>
          ) : (
            <p className="muted">No active month yet.{isFullAdmin(user.role) && " Create one in Admin → Months."}</p>
          )}
        </div>

        <div className="card">
          <h2>Quick links</h2>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><Link href="/stats">Action Stats</Link></li>
            <li><Link href="/goals/actions">Action goal scores</Link></li>
            <li><Link href="/goals/bookings">Booking goal scores</Link></li>
            {canCreateInvites(user.role) && <li><Link href="/admin/invites">Invite members</Link></li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
