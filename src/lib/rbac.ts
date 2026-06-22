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
