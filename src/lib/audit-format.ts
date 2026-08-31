import { formatDateUK } from "./dates";

export type AuditTrackerLookup = {
  monthName: string;
  typeName: string | null;
  org1Name: string | null;
  org2Name: string | null;
  actionDate: Date | null;
};

export type AuditBrTrackerLookup = {
  monthName: string;
  typeName: string | null;
  actionDate: Date | null;
};

export type AuditLookup = {
  trackerRows?: Record<string, AuditTrackerLookup>;
  brTrackerRows?: Record<string, AuditBrTrackerLookup>;
  months?: Record<string, string>;
  gangs?: Record<string, string>;
  actionTypes?: Record<string, { name: string; kind?: string | null }>;
  users?: Record<string, string>;
  staff?: Record<string, string>;
  actionLogs?: Record<string, { orgName: string; actionText: string }>;
  backups?: Record<string, { createdAt: Date }>;
};

export type AuditFormatInput = {
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  payload?: unknown;
};

export type AuditFormatResult = {
  what: string;
  details: string;
};

const ACTION_LABELS: Record<string, string> = {
  "tracker.update": "Updated the action tracker",
  "br_tracker.update": "Updated the BR tracker",
  "staff.create": "Added a staff name",
  "staff.update": "Updated a staff name",
  "staff.soft_delete": "Removed a staff name",
  "action_type.create": "Added an action type",
  "action_type.update": "Updated an action type",
  "action_type.soft_delete": "Removed an action type",
  "gang.create": "Added a gang",
  "gang.update": "Updated a gang",
  "gang.soft_delete": "Removed a gang",
  "user.create": "Created a user",
  "user.update": "Updated a user",
  "user.avatar_update": "Updated their profile photo",
  "user.delete": "Deleted a user",
  "user.reset_password": "Reset a user's password",
  "action_log.create": "Logged an action",
  "action_log.delete": "Deleted an action log",
  "backup.restore": "Restored a backup",
  "auth.password_reset": "Reset their password",
  "auth.forgot_password": "Requested a password reset",
  "auth.login": "Logged in",
  "auth.logout": "Logged out",
  "auth.signup": "Signed up",
  "month.create": "Created a month",
  "month.set_active": "Set the active month",
  "month.archive": "Archived a month",
  "month.unarchive": "Unarchived a month",
  "month.hard_delete": "Permanently deleted a month",
  "invite.create": "Created an invite",
  "invite.revoke": "Revoked an invite"
};

function asRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function str(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function joinDetails(parts: Array<string | null | undefined>): string {
  return parts
    .map(part => (part ?? "").trim())
    .filter(Boolean)
    .join(" · ");
}

function formatDateValue(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return formatDateUK(value) || null;
  if (typeof value === "string") {
    if (/^\d{2}\/\d{2}(\/\d{2,4})?$/.test(value.trim())) return value.trim();
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return formatDateUK(parsed) || null;
    return value.trim() || null;
  }
  return null;
}

function vs(left?: string | null, right?: string | null): string | null {
  const a = left?.trim() || "";
  const b = right?.trim() || "";
  if (a && b) return `${a} vs ${b}`;
  return a || b || null;
}

function kindLabel(kind: string | null | undefined): string | null {
  if (!kind) return null;
  if (kind === "br") return "BR";
  if (kind === "action") return "Action";
  return kind;
}

function fallbackLabel(action: string): string {
  const cleaned = action.replace(/[._]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "Activity";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function trackerDetails(
  payload: Record<string, unknown>,
  lookedUp?: AuditTrackerLookup
): string {
  return joinDetails([
    str(payload.month) ?? lookedUp?.monthName,
    str(payload.typeName) ?? lookedUp?.typeName,
    formatDateValue(payload.actionDate) ?? (lookedUp?.actionDate ? formatDateUK(lookedUp.actionDate) : null),
    vs(str(payload.org1Name) ?? lookedUp?.org1Name, str(payload.org2Name) ?? lookedUp?.org2Name)
  ]);
}

function brTrackerDetails(
  payload: Record<string, unknown>,
  lookedUp?: AuditBrTrackerLookup
): string {
  return joinDetails([
    str(payload.month) ?? lookedUp?.monthName,
    str(payload.typeName) ?? lookedUp?.typeName,
    formatDateValue(payload.actionDate) ?? (lookedUp?.actionDate ? formatDateUK(lookedUp.actionDate) : null)
  ]);
}

function namedDetails(
  payload: Record<string, unknown>,
  lookedUpName?: string
): string {
  return str(payload.name) ?? lookedUpName ?? "";
}

function userDetails(payload: Record<string, unknown>, lookedUpName?: string): string {
  return str(payload.username) ?? lookedUpName ?? "";
}

function actionLogDetails(
  payload: Record<string, unknown>,
  lookedUp?: { orgName: string; actionText: string }
): string {
  const org = str(payload.orgName) ?? lookedUp?.orgName;
  const text = str(payload.actionText) ?? lookedUp?.actionText;
  return joinDetails([org, text]);
}

export function formatAuditEvent(
  input: AuditFormatInput,
  lookup: AuditLookup = {}
): AuditFormatResult {
  const payload = asRecord(input.payload);
  const entityId = input.entityId ?? "";
  const oldName = str(payload.oldName);
  const name = str(payload.name) ?? lookup.gangs?.[entityId] ?? lookup.actionTypes?.[entityId]?.name;

  let what = ACTION_LABELS[input.action] ?? fallbackLabel(input.action);
  let details = "";

  if (input.action === "gang.update" && oldName && name && oldName !== name) {
    what = "Renamed a gang";
    details = `${oldName} → ${name}`;
  } else if (input.action === "action_type.update" && oldName && name && oldName !== name) {
    what = "Renamed an action type";
    details = `${oldName} → ${name}`;
  } else {
    switch (input.action) {
      case "tracker.update":
        details = trackerDetails(payload, lookup.trackerRows?.[entityId]);
        break;
      case "br_tracker.update":
        details = brTrackerDetails(payload, lookup.brTrackerRows?.[entityId]);
        break;
      case "staff.create":
      case "staff.update":
      case "staff.soft_delete":
        details = namedDetails(payload, lookup.staff?.[entityId]);
        break;
      case "action_type.create":
      case "action_type.update":
      case "action_type.soft_delete":
        details = joinDetails([
          namedDetails(payload, lookup.actionTypes?.[entityId]?.name),
          kindLabel(str(payload.kind) ?? lookup.actionTypes?.[entityId]?.kind)
        ]);
        break;
      case "gang.create":
      case "gang.update":
      case "gang.soft_delete":
        details = namedDetails(payload, lookup.gangs?.[entityId]);
        break;
      case "user.create":
      case "user.update":
      case "user.delete":
      case "user.reset_password":
      case "auth.forgot_password":
        details = userDetails(payload, lookup.users?.[entityId]);
        break;
      case "auth.password_reset": {
        const via = str(payload.via);
        details = joinDetails([
          userDetails(payload, lookup.users?.[entityId]),
          via === "email" ? "via email link" : via === "admin_required" ? "when setting a new password" : null
        ]);
        break;
      }
      case "auth.signup":
        details = userDetails(payload, lookup.users?.[entityId]);
        break;
      case "action_log.create":
      case "action_log.delete":
        details = actionLogDetails(payload, lookup.actionLogs?.[entityId]);
        break;
      case "backup.restore": {
        const createdAt = payload.createdAt ?? lookup.backups?.[entityId]?.createdAt;
        details = createdAt ? `from ${formatDateValue(createdAt)}` : "";
        break;
      }
      case "month.create":
      case "month.set_active":
      case "month.archive":
      case "month.unarchive":
      case "month.hard_delete":
        details = joinDetails([
          str(payload.name) ?? lookup.months?.[entityId],
          str(payload.reason) ? `reason: ${str(payload.reason)}` : null
        ]);
        break;
      case "invite.create": {
        const expires = formatDateValue(payload.expiresAt);
        details = expires ? `expires ${expires}` : "";
        break;
      }
      default:
        break;
    }
  }

  if (!details) {
    if (input.entityType === "tracker_row") {
      details = trackerDetails(payload, lookup.trackerRows?.[entityId]);
    } else if (input.entityType === "br_tracker_row") {
      details = brTrackerDetails(payload, lookup.brTrackerRows?.[entityId]);
    } else if (input.entityType === "month") {
      details = str(payload.name) ?? lookup.months?.[entityId] ?? "";
    } else if (input.entityType === "gang") {
      details = namedDetails(payload, lookup.gangs?.[entityId]);
    } else if (input.entityType === "action_type") {
      details = namedDetails(payload, lookup.actionTypes?.[entityId]?.name);
    } else if (input.entityType === "staff") {
      details = namedDetails(payload, lookup.staff?.[entityId]);
    } else if (input.entityType === "user") {
      details = userDetails(payload, lookup.users?.[entityId]);
    } else if (input.entityType === "action_log") {
      details = actionLogDetails(payload, lookup.actionLogs?.[entityId]);
    }
  }

  return { what, details };
}
