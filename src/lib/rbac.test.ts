import { describe, it, expect } from "vitest";
import { canViewGoalScoreRow } from "@/lib/rbac";

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
