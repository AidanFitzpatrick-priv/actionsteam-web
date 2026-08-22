import { describe, expect, it } from "vitest";
import { formatDateUKShort, londonDayRangeUtc, parseDate } from "./dates";

function ymd(d: Date | null): string {
  if (!d) return "null";
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

describe("parseDate (UK DD/MM)", () => {
  it("parses ambiguous 01/07/26 as 1 July 2026", () => {
    expect(ymd(parseDate("01/07/26"))).toBe("2026-7-1");
    expect(formatDateUKShort(parseDate("01/07/26"))).toBe("01/07/26");
  });

  it("parses 07/01/26 as 7 January 2026", () => {
    expect(ymd(parseDate("07/01/26"))).toBe("2026-1-7");
    expect(formatDateUKShort(parseDate("07/01/26"))).toBe("07/01/26");
  });

  it("parses 15/07/26 as 15 July 2026", () => {
    expect(ymd(parseDate("15/07/26"))).toBe("2026-7-15");
  });

  it("parses 07/15/26 as 15 July 2026 when day > 12", () => {
    expect(ymd(parseDate("07/15/26"))).toBe("2026-7-15");
  });

  it("returns null for empty or unparseable input", () => {
    expect(parseDate("")).toBeNull();
    expect(parseDate("not-a-date")).toBeNull();
  });
});

describe("londonDayRangeUtc", () => {
  it("uses Europe/London calendar date, including BST", () => {
    // 22 Aug 2026 23:30 UTC = 23 Aug 00:30 BST (UTC+1)
    const lateUtc = new Date("2026-08-22T23:30:00.000Z");
    const late = londonDayRangeUtc(lateUtc);
    expect(late.ymd).toBe("2026-08-23");
    expect(late.start.toISOString()).toBe("2026-08-22T23:00:00.000Z");
    expect(late.end.toISOString()).toBe("2026-08-23T23:00:00.000Z");

    const sameEvening = londonDayRangeUtc(new Date("2026-08-22T22:30:00.000Z"));
    expect(sameEvening.ymd).toBe("2026-08-22");
  });

  it("uses GMT in winter", () => {
    const winter = londonDayRangeUtc(new Date("2026-01-15T12:00:00.000Z"));
    expect(winter.ymd).toBe("2026-01-15");
    expect(winter.start.toISOString()).toBe("2026-01-15T00:00:00.000Z");
    expect(winter.end.toISOString()).toBe("2026-01-16T00:00:00.000Z");
  });
});
