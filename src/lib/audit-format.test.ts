import { describe, expect, it } from "vitest";
import { formatAuditEvent } from "./audit-format";

describe("formatAuditEvent", () => {
  it("turns tracker.update into a sentence without raw ids", () => {
    const result = formatAuditEvent({
      action: "tracker.update",
      entityType: "tracker_row",
      entityId: "cmt7gt05abc123"
    });
    expect(result.what).toBe("Updated the action tracker");
    expect(result.details).toBe("");
    expect(`${result.what} ${result.details}`).not.toMatch(/#cmt|tracker_row/);
  });

  it("uses payload names and dates for tracker rows", () => {
    const result = formatAuditEvent({
      action: "tracker.update",
      entityType: "tracker_row",
      entityId: "cmt7gt05abc123",
      payload: {
        month: "August 2026",
        typeName: "Bank of England",
        actionDate: "01/08/2026",
        org1Name: "Ballas",
        org2Name: "PD"
      }
    });
    expect(result.what).toBe("Updated the action tracker");
    expect(result.details).toBe("August 2026 · Bank of England · 01/08/2026 · Ballas vs PD");
  });

  it("looks up old tracker rows by id", () => {
    const result = formatAuditEvent(
      {
        action: "tracker.update",
        entityType: "tracker_row",
        entityId: "row1"
      },
      {
        trackerRows: {
          row1: {
            monthName: "August 2026",
            typeName: "Bank of England",
            org1Name: "Ballas",
            org2Name: null,
            actionDate: new Date(2026, 7, 1, 12)
          }
        }
      }
    );
    expect(result.details).toBe("August 2026 · Bank of England · 01/08/2026 · Ballas");
  });

  it("describes gang renames", () => {
    const result = formatAuditEvent({
      action: "gang.update",
      entityType: "gang",
      entityId: "g1",
      payload: { name: "TTK", oldName: "The Team" }
    });
    expect(result.what).toBe("Renamed a gang");
    expect(result.details).toBe("The Team → TTK");
  });

  it("describes auth.login without an entity", () => {
    const result = formatAuditEvent({ action: "auth.login" });
    expect(result.what).toBe("Logged in");
    expect(result.details).toBe("");
  });

  it("describes action log creates", () => {
    const result = formatAuditEvent({
      action: "action_log.create",
      entityType: "action_log",
      entityId: "log1",
      payload: { orgName: "Ballas", actionText: "Hosted Bank" }
    });
    expect(result.what).toBe("Logged an action");
    expect(result.details).toBe("Ballas · Hosted Bank");
  });

  it("describes month deletes with a name instead of an id", () => {
    const result = formatAuditEvent({
      action: "month.hard_delete",
      entityType: "month",
      entityId: "m1",
      payload: { name: "July 2026", reason: "duplicate" }
    });
    expect(result.what).toBe("Permanently deleted a month");
    expect(result.details).toBe("July 2026 · reason: duplicate");
    expect(result.details).not.toContain("m1");
  });

  it("humanises unknown action codes", () => {
    const result = formatAuditEvent({ action: "custom.thing_done" });
    expect(result.what).toBe("Custom thing done");
  });
});
