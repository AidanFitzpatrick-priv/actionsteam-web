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

/** Admin → Users: may change role only for users strictly below actor rank. */
export function canEditUserRole(actorRole: UserRole, targetUserRole: UserRole): boolean {
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

export function canHardDeleteMonth(role: UserRole): boolean {
  return role === "adm" || role === "management";
}

export function canViewBackups(role: UserRole): boolean {
  return role === "adm" || role === "management";
}

/** Admin → Users: aux+ may edit usernames. */
export function canEditUsername(role: UserRole): boolean {
  return hasMinRole(role, "aux");
}

/** Admin → Users: aux+ may delete users strictly below their rank. */
export function canDeleteUser(actorRole: UserRole, targetUserRole: UserRole): boolean {
  return hasMinRole(actorRole, "aux") && roleLevel(targetUserRole) < roleLevel(actorRole);
}

/** Admin → Users: aux+ may force password reset for users strictly below their rank. */
export function canResetUserPassword(actorRole: UserRole, targetUserRole: UserRole): boolean {
  return hasMinRole(actorRole, "aux") && roleLevel(targetUserRole) < roleLevel(actorRole);
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
