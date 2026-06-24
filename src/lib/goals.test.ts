import { describe, it, expect } from "vitest";
import { goalMet } from "@/lib/goals";

describe("goalMet", () => {
  it("is false at 10 or below", () => {
    expect(goalMet(10)).toBe(false);
    expect(goalMet(0)).toBe(false);
  });

  it("is true above 10", () => {
    expect(goalMet(11)).toBe(true);
    expect(goalMet(20)).toBe(true);
  });
});
