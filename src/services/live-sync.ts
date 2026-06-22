import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { canCreateInvites, isFullAdmin } from "@/lib/rbac";
import type { LiveEventPayload, LiveEventRecord, LiveEventScope } from "@/lib/live-events";

const RETAIN_MS = 60 * 60 * 1000;

/** Insert a live event. Works across Railway instances via DB polling. */
export async function publishLiveEvent(event: LiveEventPayload): Promise<void> {
  try {
    await prisma.liveEvent.create({
      data: {
        type: event.type,
        scope: event.scope,
        monthId: event.monthId ?? null,
        monthSlug: event.monthSlug ?? null,
        entityId: event.entityId ?? null,
        payload: event.payload ?? undefined,
        actorId: event.actorId ?? null
      }
    });

    const cutoff = new Date(Date.now() - RETAIN_MS);
    await prisma.liveEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
  } catch (err) {
    console.error("[live-sync] publish failed:", err instanceof Error ? err.message : err);
  }
}

export function eventVisibleToUser(
  event: LiveEventPayload,
  role: UserRole,
  opts?: { monthSlug?: string }
): boolean {
  if (event.scope === "admin" || event.scope === "invites") {
    if (event.scope === "invites") return canCreateInvites(role);
    return isFullAdmin(role);
  }

  if (event.scope === "month" && opts?.monthSlug && event.monthSlug && event.monthSlug !== opts.monthSlug) {
    return false;
  }

  return true;
}

export async function fetchLiveEventsSince(
  since: Date,
  role: UserRole,
  filters?: { monthSlug?: string; admin?: boolean; invites?: boolean }
): Promise<LiveEventRecord[]> {
  const rows = await prisma.liveEvent.findMany({
    where: { createdAt: { gt: since } },
    orderBy: { createdAt: "asc" },
    take: 100
  });

  return rows
    .map(r => ({
      id: r.id,
      createdAt: r.createdAt.toISOString(),
      type: r.type as LiveEventPayload["type"],
      scope: r.scope as LiveEventScope,
      monthId: r.monthId ?? undefined,
      monthSlug: r.monthSlug ?? undefined,
      entityId: r.entityId ?? undefined,
      payload: r.payload ?? undefined,
      actorId: r.actorId ?? undefined
    }))
    .filter(ev => {
      if (ev.scope === "admin" && !filters?.admin && !isFullAdmin(role)) return false;
      if (ev.scope === "invites" && !filters?.invites && !canCreateInvites(role)) return false;
      if (ev.scope === "month" && filters?.monthSlug && ev.monthSlug !== filters.monthSlug) return false;
      if (
        filters?.monthSlug &&
        ev.monthSlug &&
        ev.monthSlug !== filters.monthSlug &&
        (ev.type === "stats.updated" || ev.type === "goals.updated")
      ) {
        return false;
      }
      return eventVisibleToUser(ev, role, { monthSlug: filters?.monthSlug });
    });
}

/** Immediate broadcast for tracker UI sync (must not wait on points recalc). */
export async function publishMonthTrackerChange(params: {
  monthId: string;
  monthSlug: string;
  actorId: string;
  action: "updated" | "added" | "deleted";
  rowId?: string;
}) {
  const type =
    params.action === "added"
      ? "tracker.added"
      : params.action === "deleted"
        ? "tracker.deleted"
        : "tracker.updated";

  await publishLiveEvent({
    type,
    scope: "month",
    monthId: params.monthId,
    monthSlug: params.monthSlug,
    entityId: params.rowId,
    actorId: params.actorId
  });
}

/** After points recalc — stats + goals pages refresh. */
export async function publishTrackerDerivedUpdates(params: {
  monthId: string;
  monthSlug: string;
  actorId: string;
}) {
  await publishLiveEvent({
    type: "stats.updated",
    scope: "global",
    monthId: params.monthId,
    monthSlug: params.monthSlug,
    actorId: params.actorId
  });

  await publishLiveEvent({
    type: "goals.updated",
    scope: "global",
    monthId: params.monthId,
    monthSlug: params.monthSlug,
    actorId: params.actorId
  });
}

export async function publishScheduleChange(params: {
  monthId: string;
  monthSlug: string;
  actorId: string;
  slotId: string;
}) {
  await publishLiveEvent({
    type: "schedule.updated",
    scope: "month",
    monthId: params.monthId,
    monthSlug: params.monthSlug,
    entityId: params.slotId,
    actorId: params.actorId
  });
}

export async function publishScheduleDerivedUpdates(params: {
  monthId: string;
  monthSlug: string;
  actorId: string;
}) {
  await publishLiveEvent({
    type: "goals.updated",
    scope: "global",
    monthId: params.monthId,
    monthSlug: params.monthSlug,
    actorId: params.actorId
  });
}

export async function publishAdminChange(actorId: string, detail?: string) {
  await publishLiveEvent({
    type: "admin.updated",
    scope: "admin",
    actorId,
    payload: detail ? { detail } : undefined
  });
}

export async function publishInvitesChange(actorId: string) {
  await publishLiveEvent({
    type: "invites.updated",
    scope: "invites",
    actorId
  });
}
