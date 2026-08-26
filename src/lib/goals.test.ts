import { describe, it, expect } from "vitest";
import { WEEKLY_ACTION_GOAL, goalMet, teamGoalScores } from "@/lib/goals";

describe("goalMet", () => {
  it("is false below 10", () => {
    expect(WEEKLY_ACTION_GOAL).toBe(10);
    expect(goalMet(9)).toBe(false);
    expect(goalMet(0)).toBe(false);
  });

  it("is true at 10 or above", () => {
    expect(goalMet(10)).toBe(true);
    expect(goalMet(11)).toBe(true);
    expect(goalMet(20)).toBe(true);
  });
});

describe("teamGoalScores", () => {
  it("drops AUX+ from team visuals while keeping leads and members", () => {
    const kept = teamGoalScores([
      { role: "member" as const, staffName: "Sam" },
      { role: "lead" as const, staffName: "Kim" },
      { role: "aux" as const, staffName: "AuxUser" },
      { role: "adm" as const, staffName: "AdmUser" },
      { role: "management" as const, staffName: "admin" }
    ]);
    expect(kept.map(r => r.staffName)).toEqual(["Sam", "Kim"]);
  });
});
