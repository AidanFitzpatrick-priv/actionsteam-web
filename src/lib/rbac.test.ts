import { describe, it, expect } from "vitest";
import {
  allowedRoleOptionsForActor,
  canAssignRole,
  canEditUserRole,
  canHardDeleteMonth,
  canViewBackups,
  canViewGoalScoreRow
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

describe("canHardDeleteMonth", () => {
  it("allows adm and management only", () => {
    expect(canHardDeleteMonth("adm")).toBe(true);
    expect(canHardDeleteMonth("management")).toBe(true);
  });

  it("denies aux and below", () => {
    expect(canHardDeleteMonth("aux")).toBe(false);
    expect(canHardDeleteMonth("lead")).toBe(false);
    expect(canHardDeleteMonth("member")).toBe(false);
  });
});

describe("canViewBackups", () => {
  it("allows adm and management only", () => {
    expect(canViewBackups("adm")).toBe(true);
    expect(canViewBackups("management")).toBe(true);
  });

  it("denies aux and below", () => {
    expect(canViewBackups("aux")).toBe(false);
    expect(canViewBackups("lead")).toBe(false);
    expect(canViewBackups("member")).toBe(false);
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
