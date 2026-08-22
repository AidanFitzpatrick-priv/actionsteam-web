import { describe, expect, it } from "vitest";
import { buildDailyGoalRows, normalizeActionLogFields } from "./action-log";

describe("normalizeActionLogFields", () => {
  const base = {
    orgName: "Vagos",
    actionText: "Ran a raid",
    proofUrl: "https://clips.example/raid-12"
  };

  it("accepts a positive log with a number", () => {
    const parsed = normalizeActionLogFields({
      ...base,
      result: "positive",
      positiveNumber: 12
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.result).toBe("positive");
      expect(parsed.value.positiveNumber).toBe(12);
      expect(parsed.value.negativeReason).toBeNull();
    }
  });

  it("rejects positive without a number", () => {
    const parsed = normalizeActionLogFields({
      ...base,
      result: "positive",
      positiveNumber: null
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/numbers/i);
  });

  it("accepts a negative log with a reason and drops the number", () => {
    const parsed = normalizeActionLogFields({
      ...base,
      result: "negative",
      positiveNumber: 12,
      negativeReason: "Org 1 didn't show"
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.result).toBe("negative");
      expect(parsed.value.positiveNumber).toBeNull();
      expect(parsed.value.negativeReason).toBe("Org 1 didn't show");
    }
  });

  it("rejects negative without a reason", () => {
    const parsed = normalizeActionLogFields({
      ...base,
      result: "negative",
      negativeReason: "  "
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/why/i);
  });

  it("rejects a non-url proof", () => {
    const parsed = normalizeActionLogFields({
      ...base,
      result: "positive",
      positiveNumber: 1,
      proofUrl: "not-a-link"
    });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toMatch(/link/i);
  });

  it("rejects a non-http proof", () => {
    const parsed = normalizeActionLogFields({
      ...base,
      result: "positive",
      positiveNumber: 1,
      proofUrl: "javascript:alert(1)"
    });
    expect(parsed.ok).toBe(false);
  });
});

describe("buildDailyGoalRows", () => {
  it("excludes management and hidden users, marks met from today's logs", () => {
    const rows = buildDailyGoalRows(
      [
        { username: "boss", role: "management", hiddenFromGoalTrackers: false },
        { username: "hidden", role: "member", hiddenFromGoalTrackers: true },
        { username: "Aidan", role: "aux", hiddenFromGoalTrackers: false },
        { username: "Sam", role: "member", hiddenFromGoalTrackers: false }
      ],
      new Set(["Aidan"])
    );

    expect(rows.map(r => r.staffName)).toEqual(["Aidan", "Sam"]);
    expect(rows.find(r => r.staffName === "Aidan")?.met).toBe(true);
    expect(rows.find(r => r.staffName === "Sam")?.met).toBe(false);
  });
});
