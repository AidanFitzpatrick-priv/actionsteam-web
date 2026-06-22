import { describe, it, expect } from "vitest";
import { cityIdSchema, usernameSchema } from "@/lib/user-fields";

describe("usernameSchema", () => {
  it("accepts valid usernames", () => {
    expect(usernameSchema.parse("  Barry  ")).toBe("Barry");
    expect(usernameSchema.parse("NewWorld-")).toBe("NewWorld-");
  });

  it("rejects invalid usernames", () => {
    expect(() => usernameSchema.parse("ab")).toThrow();
    expect(() => usernameSchema.parse("bad name")).toThrow();
  });
});

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
