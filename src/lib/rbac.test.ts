import { describe, it, expect } from "vitest";
import {
  allowedRoleOptionsForActor,
  canAssignRole,
  canEditUserRole,
  canDeleteUser,
  canResetUserPassword,
  canEditUsername,
  canViewBackups,
  canManageGoalTrackerVisibility,
  canViewGoalScoreRow,
  isAuxPlus,
  isRankedActionParticipant,
  shouldShowOnGoalTracker,
  sortGoalTrackerRows,
  canViewAllActionLogs,
  canDeleteActionLog
} from "@/lib/rbac";

describe("canEditUserRole", () => {
  it("allows editing strictly below actor rank", () => {
    expect(canEditUserRole("aux", "member")).toBe(true);
    expect(canEditUserRole("aux", "lead")).toBe(true);
    expect(canEditUserRole("lead", "member")).toBe(true);
  });

  it("blocks same rank or higher", () => {
    expect(canEditUserRole("aux", "aux")).toBe(false);
    expect(canEditUserRole("aux", "adm")).toBe(false);
    expect(canEditUserRole("lead", "aux")).toBe(false);
  });

  it("allows the admin account to change other management roles", () => {
    expect(canEditUserRole("management", "management", "pat", "admin")).toBe(true);
    expect(canEditUserRole("management", "management", "pat", "Admin")).toBe(true);
  });

  it("blocks other management from changing peer management roles", () => {
    expect(canEditUserRole("management", "management", "pat", "boss")).toBe(false);
    expect(canEditUserRole("management", "management", "pat")).toBe(false);
  });

  it("never allows changing the protected admin account role", () => {
    expect(canEditUserRole("management", "management", "admin", "boss")).toBe(false);
    expect(canEditUserRole("management", "management", "Admin", "admin")).toBe(false);
  });
});

describe("allowedRoleOptionsForActor", () => {
  it("lead may assign member and sub_lead only", () => {
    expect(allowedRoleOptionsForActor("lead")).toEqual(["member", "sub_lead"]);
  });

  it("management includes management", () => {
    expect(allowedRoleOptionsForActor("management")).toContain("management");
    expect(allowedRoleOptionsForActor("management")).toContain("adm");
  });

  it("adm cannot assign management", () => {
    expect(allowedRoleOptionsForActor("adm")).not.toContain("management");
    expect(allowedRoleOptionsForActor("adm")).toContain("aux");
  });
});

describe("canAssignRole", () => {
  it("blocks assigning at or above actor rank", () => {
    expect(canAssignRole("lead", "aux")).toBe(false);
    expect(canAssignRole("lead", "lead")).toBe(false);
  });

  it("blocks non-management assigning management", () => {
    expect(canAssignRole("adm", "management")).toBe(false);
    expect(canAssignRole("management", "management")).toBe(true);
  });

  it("allows assigning below actor", () => {
    expect(canAssignRole("aux", "member")).toBe(true);
    expect(canAssignRole("management", "adm")).toBe(true);
  });
});

describe("canDeleteUser", () => {
  it("allows aux+ to delete strictly below rank", () => {
    expect(canDeleteUser("aux", "member", "sam")).toBe(true);
    expect(canDeleteUser("adm", "aux", "kai")).toBe(true);
    expect(canDeleteUser("management", "adm", "ada")).toBe(true);
  });

  it("blocks same rank or higher", () => {
    expect(canDeleteUser("aux", "aux", "kai")).toBe(false);
    expect(canDeleteUser("aux", "adm", "ada")).toBe(false);
    expect(canDeleteUser("lead", "member", "sam")).toBe(false);
    expect(canDeleteUser("adm", "management", "pat")).toBe(false);
  });

  it("allows management to delete other management", () => {
    expect(canDeleteUser("management", "management", "pat")).toBe(true);
    expect(canDeleteUser("management", "management", "pat", "admin")).toBe(true);
  });

  it("never allows deleting the protected admin account", () => {
    expect(canDeleteUser("management", "management", "admin")).toBe(false);
    expect(canDeleteUser("management", "management", "Admin")).toBe(false);
    expect(canDeleteUser("management", "management", "admin", "boss")).toBe(false);
    expect(canDeleteUser("adm", "management", "admin")).toBe(false);
    expect(canDeleteUser("aux", "member", "admin")).toBe(false);
  });
});

describe("canResetUserPassword", () => {
  it("allows aux+ to reset strictly below rank", () => {
    expect(canResetUserPassword("aux", "member")).toBe(true);
    expect(canResetUserPassword("adm", "aux")).toBe(true);
    expect(canResetUserPassword("management", "adm")).toBe(true);
  });

  it("blocks same rank or higher", () => {
    expect(canResetUserPassword("aux", "aux")).toBe(false);
    expect(canResetUserPassword("aux", "adm")).toBe(false);
    expect(canResetUserPassword("lead", "member")).toBe(false);
    expect(canResetUserPassword("management", "management", "pat")).toBe(false);
    expect(canResetUserPassword("management", "management", "pat", "boss")).toBe(false);
  });

  it("allows the admin account to reset other management passwords", () => {
    expect(canResetUserPassword("management", "management", "pat", "admin")).toBe(true);
    expect(canResetUserPassword("management", "management", "pat", "Admin")).toBe(true);
  });

  it("never allows resetting the protected admin account", () => {
    expect(canResetUserPassword("management", "management", "admin", "boss")).toBe(false);
    expect(canResetUserPassword("management", "management", "Admin", "admin")).toBe(false);
    expect(canResetUserPassword("adm", "management", "admin")).toBe(false);
  });
});

describe("canEditUsername", () => {
  it("allows aux and above", () => {
    expect(canEditUsername("aux")).toBe(true);
    expect(canEditUsername("adm")).toBe(true);
    expect(canEditUsername("management")).toBe(true);
  });

  it("denies below aux", () => {
    expect(canEditUsername("lead")).toBe(false);
    expect(canEditUsername("member")).toBe(false);
  });
});

describe("canViewBackups", () => {
  it("allows only the reserved admin account", () => {
    expect(canViewBackups("admin")).toBe(true);
    expect(canViewBackups("Admin")).toBe(true);
    expect(canViewBackups("ADMIN")).toBe(true);
    expect(canViewBackups("  admin  ")).toBe(true);
  });

  it("denies other usernames including other management", () => {
    expect(canViewBackups("boss")).toBe(false);
    expect(canViewBackups("management")).toBe(false);
    expect(canViewBackups("adm")).toBe(false);
    expect(canViewBackups("aux")).toBe(false);
    expect(canViewBackups("lead")).toBe(false);
    expect(canViewBackups("member")).toBe(false);
  });
});

describe("canManageGoalTrackerVisibility", () => {
  it("allows management only", () => {
    expect(canManageGoalTrackerVisibility("management")).toBe(true);
    expect(canManageGoalTrackerVisibility("adm")).toBe(false);
    expect(canManageGoalTrackerVisibility("aux")).toBe(false);
  });
});

describe("shouldShowOnGoalTracker", () => {
  it("excludes management", () => {
    expect(shouldShowOnGoalTracker("management")).toBe(false);
  });

  it("excludes users hidden from goal trackers", () => {
    expect(shouldShowOnGoalTracker("member", true)).toBe(false);
    expect(shouldShowOnGoalTracker("adm", true)).toBe(false);
  });

  it("includes other roles when not hidden", () => {
    expect(shouldShowOnGoalTracker("adm")).toBe(true);
    expect(shouldShowOnGoalTracker("aux")).toBe(true);
    expect(shouldShowOnGoalTracker("lead")).toBe(true);
    expect(shouldShowOnGoalTracker("sub_lead")).toBe(true);
    expect(shouldShowOnGoalTracker("member")).toBe(true);
    expect(shouldShowOnGoalTracker("member", false)).toBe(true);
  });
});

describe("isRankedActionParticipant", () => {
  it("treats aux and above as AUX+", () => {
    expect(isAuxPlus("member")).toBe(false);
    expect(isAuxPlus("lead")).toBe(false);
    expect(isAuxPlus("aux")).toBe(true);
    expect(isAuxPlus("adm")).toBe(true);
    expect(isAuxPlus("management")).toBe(true);
  });

  it("includes members, sub-leads, and leads", () => {
    expect(isRankedActionParticipant("member")).toBe(true);
    expect(isRankedActionParticipant("sub_lead")).toBe(true);
    expect(isRankedActionParticipant("lead")).toBe(true);
  });

  it("excludes AUX+ and hidden users from leaderboard / goals team lists", () => {
    expect(isRankedActionParticipant("aux")).toBe(false);
    expect(isRankedActionParticipant("adm")).toBe(false);
    expect(isRankedActionParticipant("management")).toBe(false);
    expect(isRankedActionParticipant("member", true)).toBe(false);
  });
});

describe("sortGoalTrackerRows", () => {
  it("orders by role group then name", () => {
    const sorted = sortGoalTrackerRows([
      { staffName: "Zed", role: "member", points: [0, 0, 0, 0, 0, 0, 0], total: 0 },
      { staffName: "Amy", role: "aux", points: [0, 0, 0, 0, 0, 0, 0], total: 0 },
      { staffName: "Bob", role: "member", points: [0, 0, 0, 0, 0, 0, 0], total: 0 }
    ]);
    expect(sorted.map(r => r.staffName)).toEqual(["Amy", "Bob", "Zed"]);
  });
});

describe("canViewGoalScoreRow", () => {
  it("member sees only own row", () => {
    expect(canViewGoalScoreRow("member", "member", true)).toBe(true);
    expect(canViewGoalScoreRow("member", "member", false)).toBe(false);
    expect(canViewGoalScoreRow("member", "sub_lead", false)).toBe(false);
  });

  it("sub_lead sees members and self", () => {
    expect(canViewGoalScoreRow("sub_lead", "member", false)).toBe(true);
    expect(canViewGoalScoreRow("sub_lead", "sub_lead", false)).toBe(false);
    expect(canViewGoalScoreRow("sub_lead", "sub_lead", true)).toBe(true);
  });

  it("lead sees members and sub_leads", () => {
    expect(canViewGoalScoreRow("lead", "sub_lead", false)).toBe(true);
    expect(canViewGoalScoreRow("lead", "lead", false)).toBe(false);
    expect(canViewGoalScoreRow("lead", "aux", false)).toBe(false);
  });

  it("aux sees below lead", () => {
    expect(canViewGoalScoreRow("aux", "lead", false)).toBe(true);
    expect(canViewGoalScoreRow("aux", "aux", false)).toBe(false);
  });

  it("management sees everyone", () => {
    expect(canViewGoalScoreRow("management", "management", false)).toBe(true);
    expect(canViewGoalScoreRow("management", "aux", false)).toBe(true);
    expect(canViewGoalScoreRow("adm", "member", false)).toBe(true);
  });
});

describe("canViewAllActionLogs", () => {
  it("allows aux and above", () => {
    expect(canViewAllActionLogs("aux")).toBe(true);
    expect(canViewAllActionLogs("adm")).toBe(true);
    expect(canViewAllActionLogs("management")).toBe(true);
  });

  it("denies below aux", () => {
    expect(canViewAllActionLogs("lead")).toBe(false);
    expect(canViewAllActionLogs("sub_lead")).toBe(false);
    expect(canViewAllActionLogs("member")).toBe(false);
  });
});

describe("canDeleteActionLog", () => {
  it("allows the author", () => {
    expect(canDeleteActionLog({ id: "u1", role: "member" }, "u1")).toBe(true);
  });

  it("allows management to delete others", () => {
    expect(canDeleteActionLog({ id: "m1", role: "management" }, "u1")).toBe(true);
  });

  it("blocks aux and adm from deleting others", () => {
    expect(canDeleteActionLog({ id: "aux1", role: "aux" }, "u1")).toBe(false);
    expect(canDeleteActionLog({ id: "adm1", role: "adm" }, "u1")).toBe(false);
  });

  it("blocks members deleting others", () => {
    expect(canDeleteActionLog({ id: "u1", role: "member" }, "u2")).toBe(false);
    expect(canDeleteActionLog({ id: "u1", role: "lead" }, "u2")).toBe(false);
  });
});
