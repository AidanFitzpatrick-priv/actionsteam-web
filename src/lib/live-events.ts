/** Live sync event types — stored in DB for multi-instance polling on Railway. */

export type LiveEventType =
  | "tracker.updated"
  | "tracker.added"
  | "tracker.deleted"
  | "br_tracker.updated"
  | "br_tracker.added"
  | "br_tracker.deleted"
  | "schedule.updated"
  | "stats.updated"
  | "goals.updated"
  | "admin.updated"
  | "invites.updated";

export type LiveEventScope = "month" | "global" | "admin" | "invites";

export type LiveEventPayload = {
  type: LiveEventType;
  scope: LiveEventScope;
  monthId?: string;
  monthSlug?: string;
  entityId?: string;
  payload?: unknown;
  actorId?: string;
};

export type LiveEventRecord = LiveEventPayload & {
  id: string;
  createdAt: string;
};
