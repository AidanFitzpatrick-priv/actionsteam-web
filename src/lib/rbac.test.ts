import { describe, it, expect } from "vitest";
import { hasMinRole, canCreateInvites, canViewAllInvites, isFullAdmin, canRestoreProduction } from "./rbac";
import { inviteStatus } from "@/services/invites";

describe("RBAC", () => {
  it("role hierarchy", () => {
    expect(hasMinRole("management", "aux")).toBe(true);
    expect(hasMinRole("lead", "aux")).toBe(false);
    expect(hasMinRole("sub_lead", "sub_lead")).toBe(true);
  });

  it("invite permissions", () => {
    expect(canCreateInvites("member")).toBe(false);
    expect(canCreateInvites("sub_lead")).toBe(true);
    expect(canCreateInvites("lead")).toBe(true);
    expect(canViewAllInvites("lead")).toBe(false);
    expect(canViewAllInvites("aux")).toBe(true);
    expect(isFullAdmin("adm")).toBe(true);
    expect(canRestoreProduction("adm")).toBe(false);
    expect(canRestoreProduction("management")).toBe(true);
  });
});

describe("inviteStatus", () => {
  it("detects pending vs used", () => {
    const future = new Date(Date.now() + 86400000);
    expect(inviteStatus({ revokedAt: null, expiresAt: future, useCount: 0, maxUses: 1 })).toBe("pending");
    expect(inviteStatus({ revokedAt: null, expiresAt: future, useCount: 1, maxUses: 1 })).toBe("used");
  });
});
