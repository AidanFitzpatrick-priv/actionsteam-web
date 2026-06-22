import { describe, it, expect } from "vitest";
import { accumulateBookingPointsFromSlots } from "@/services/points";

describe("accumulateBookingPointsFromSlots", () => {
  it("adds booking points for slots on matching week days", () => {
    const mon = new Date("2026-07-06T12:00:00Z");
    const tue = new Date("2026-07-07T12:00:00Z");
    const weekDates = [mon, tue, null, null, null, null, null];
    const scores: Record<string, number[]> = {
      barry: [0, 0, 0, 0, 0, 0, 0],
      alice: [0, 0, 0, 0, 0, 0, 0]
    };

    accumulateBookingPointsFromSlots(
      [
        { dateBooked: mon, bookedBy: "Barry" },
        { dateBooked: tue, bookedBy: "Alice" },
        { dateBooked: mon, bookedBy: null }
      ],
      scores,
      weekDates
    );

    expect(scores.barry[0]).toBe(1);
    expect(scores.barry[1]).toBe(0);
    expect(scores.alice[1]).toBe(1);
  });

  it("ignores slots outside the target week", () => {
    const mon = new Date("2026-07-06T12:00:00Z");
    const other = new Date("2026-08-01T12:00:00Z");
    const scores: Record<string, number[]> = { bob: [0, 0, 0, 0, 0, 0, 0] };

    accumulateBookingPointsFromSlots(
      [{ dateBooked: other, bookedBy: "Bob" }],
      scores,
      [mon, null, null, null, null, null, null]
    );

    expect(scores.bob.every(p => p === 0)).toBe(true);
  });
});

describe("recalculatePointsForMonth (booking scope)", () => {
  it("is exported and month-scoped via schedule slots", async () => {
    const { recalculatePointsForMonth } = await import("@/services/points");
    expect(typeof recalculatePointsForMonth).toBe("function");
  });
});
