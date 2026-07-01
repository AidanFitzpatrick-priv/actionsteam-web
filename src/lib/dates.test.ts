import { describe, expect, it } from "vitest";
import { formatDateUKShort, parseDate } from "./dates";

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
