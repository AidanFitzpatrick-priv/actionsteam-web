import { UserRole } from "@prisma/client";

/** Role hierarchy low → high (matches spec §3.1). */
export const ROLE_ORDER: UserRole[] = [
  "member",
  "sub_lead",
  "lead",
  "aux",
  "adm",
  "management"
];

export function roleLevel(role: UserRole): number {
  return ROLE_ORDER.indexOf(role);
}

export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return roleLevel(userRole) >= roleLevel(minRole);
}

/** Aux, adm, and management (including the reserved `admin` account). */
export function isAuxPlus(role: UserRole): boolean {
  return hasMinRole(role, "aux");
}

/** Leaderboard + goals team widgets: action-takers below aux, not hidden. */
export function isRankedActionParticipant(
  targetRole: UserRole,
  hiddenFromGoalTrackers = false
): boolean {
  if (isAuxPlus(targetRole)) return false;
  if (hiddenFromGoalTrackers) return false;
  return true;
}

export function canCreateInvites(role: UserRole): boolean {
  return hasMinRole(role, "sub_lead");
}

export function canViewAllInvites(role: UserRole): boolean {
  return hasMinRole(role, "aux");
}

export function isFullAdmin(role: UserRole): boolean {
  return hasMinRole(role, "aux");
}

export function canRestoreProduction(role: UserRole): boolean {
  return role === "management";
}

export function formatRole(role: UserRole): string {
  return role.replace(/_/g, " ");
}

/** The reserved `admin` username (case-insensitive). Not the same as the management role. */
export function isProtectedAdminAccount(username: string): boolean {
  return username.trim().toLowerCase() === "admin";
}

/** The `admin` account may manage other management members (role / delete / reset). */
function adminCanManageManagement(
  actorUsername: string | undefined,
  targetUserRole: UserRole,
  targetUsername?: string
): boolean {
  if (!actorUsername || !isProtectedAdminAccount(actorUsername)) return false;
  if (targetUsername !== undefined && isProtectedAdminAccount(targetUsername)) return false;
  return targetUserRole === "management";
}

/** Admin → Users: may change role only for users strictly below actor rank.
 *  The `admin` account may also change other management members' roles. */
export function canEditUserRole(
  actorRole: UserRole,
  targetUserRole: UserRole,
  targetUsername?: string,
  actorUsername?: string
): boolean {
  if (targetUsername !== undefined && isProtectedAdminAccount(targetUsername)) return false;
  if (adminCanManageManagement(actorUsername, targetUserRole, targetUsername)) return true;
  return roleLevel(targetUserRole) < roleLevel(actorRole);
}

/** Roles an actor may assign (strictly below actor; management only if actor is management). */
export function allowedRoleOptionsForActor(actorRole: UserRole): UserRole[] {
  return ROLE_ORDER.filter(r => {
    if (r === "management") return actorRole === "management";
    return roleLevel(r) < roleLevel(actorRole);
  });
}

export function canAssignRole(actorRole: UserRole, newRole: UserRole): boolean {
  if (newRole === "management") return actorRole === "management";
  return roleLevel(newRole) < roleLevel(actorRole);
}

/** Backups UI/API: only the reserved `admin` account, not other management. */
export function canViewBackups(username: string): boolean {
  return isProtectedAdminAccount(username);
}

/** Admin → Users: aux+ may edit usernames. */
export function canEditUsername(role: UserRole): boolean {
  return hasMinRole(role, "aux");
}

/** Admin → Users: aux+ may delete users strictly below their rank.
 *  Management may also delete other management, except the protected `admin` account.
 *  The `admin` account may delete other management (same as other management today). */
export function canDeleteUser(
  actorRole: UserRole,
  targetUserRole: UserRole,
  targetUsername?: string,
  actorUsername?: string
): boolean {
  if (targetUsername !== undefined && isProtectedAdminAccount(targetUsername)) return false;
  if (!hasMinRole(actorRole, "aux")) return false;
  if (adminCanManageManagement(actorUsername, targetUserRole, targetUsername)) return true;
  if (actorRole === "management" && targetUserRole === "management") return true;
  return roleLevel(targetUserRole) < roleLevel(actorRole);
}

/** Admin → Users: aux+ may force password reset for users strictly below their rank.
 *  The `admin` account may also reset other management members. Never the `admin` account. */
export function canResetUserPassword(
  actorRole: UserRole,
  targetUserRole: UserRole,
  targetUsername?: string,
  actorUsername?: string
): boolean {
  if (targetUsername !== undefined && isProtectedAdminAccount(targetUsername)) return false;
  if (adminCanManageManagement(actorUsername, targetUserRole, targetUsername)) return true;
  return hasMinRole(actorRole, "aux") && roleLevel(targetUserRole) < roleLevel(actorRole);
}

/** Action log: aux+ see every submission. */
export function canViewAllActionLogs(role: UserRole): boolean {
  return hasMinRole(role, "aux");
}

/** Authors may delete their own log; only management may delete someone else's. */
export function canDeleteActionLog(
  actor: { id: string; role: UserRole },
  logUserId: string
): boolean {
  if (actor.id === logUserId) return true;
  return actor.role === "management";
}

/** Goal scores: own row + everyone strictly below viewer rank; adm/management see all. */
export function canViewGoalScoreRow(
  viewerRole: UserRole,
  targetRole: UserRole,
  isOwnRow: boolean
): boolean {
  if (isOwnRow) return true;
  if (viewerRole === "adm" || viewerRole === "management") return true;
  return roleLevel(targetRole) < roleLevel(viewerRole);
}

/** Only management may toggle goal-tracker visibility for other users. */
export function canManageGoalTrackerVisibility(actorRole: UserRole): boolean {
  return actorRole === "management";
}

/** Goal tracker row visibility (role + per-user flag). Also used for account-user dropdowns. */
export function shouldShowOnGoalTracker(
  targetRole: UserRole,
  hiddenFromGoalTrackers = false
): boolean {
  if (targetRole === "management") return false;
  if (hiddenFromGoalTrackers) return false;
  return true;
}

/** Goal tracker section order (top → bottom); excludes management. */
export const GOAL_TRACKER_ROLE_GROUPS: { role: UserRole; label: string }[] = [
  { role: "adm", label: "Adm" },
  { role: "aux", label: "Aux" },
  { role: "lead", label: "Lead" },
  { role: "sub_lead", label: "S. Ld" },
  { role: "member", label: "Member" }
];

/** Admin → Users section order (top → bottom); includes management. */
export const ADMIN_USER_ROLE_GROUPS: { role: UserRole; label: string }[] = [
  { role: "management", label: "Management" },
  ...GOAL_TRACKER_ROLE_GROUPS
];

export type GoalTrackerScoreRow = {
  staffName: string;
  role: UserRole;
  points: number[];
  total: number;
};

export function sortGoalTrackerRows(rows: GoalTrackerScoreRow[]): GoalTrackerScoreRow[] {
  const order = new Map(GOAL_TRACKER_ROLE_GROUPS.map((g, i) => [g.role, i]));
  return [...rows].sort((a, b) => {
    const ai = order.get(a.role) ?? 999;
    const bi = order.get(b.role) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.staffName.localeCompare(b.staffName, undefined, { sensitivity: "base" });
  });
}
