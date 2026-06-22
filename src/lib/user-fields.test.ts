import { describe, it, expect } from "vitest";
import { cityIdSchema } from "@/lib/user-fields";

describe("cityIdSchema", () => {
  it("accepts non-empty trimmed ids", () => {
    expect(cityIdSchema.parse("  ABC123  ")).toBe("ABC123");
  });

  it("rejects empty", () => {
    expect(() => cityIdSchema.parse("")).toThrow();
    expect(() => cityIdSchema.parse("   ")).toThrow();
  });

  it("rejects too long", () => {
    expect(() => cityIdSchema.parse("x".repeat(65))).toThrow();
  });
});
