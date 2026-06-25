import { describe, it, expect } from "vitest";
import { pruneOrphanedGoalScores } from "@/services/points";

describe("recalculatePointsForMonth", () => {
  it("is exported for action goal score recalc", async () => {
    const { recalculatePointsForMonth } = await import("@/services/points");
    expect(typeof recalculatePointsForMonth).toBe("function");
  });
});

describe("pruneOrphanedGoalScores", () => {
  it("is exported for goal score cleanup", () => {
    expect(typeof pruneOrphanedGoalScores).toBe("function");
  });
});
