import { describe, expect, it } from "vitest";
import {
  BR_ACTION_TYPE_NAMES,
  TRACKER_HIDDEN_ACTION_TYPE_NAMES,
  filterTypesForActionTracker,
  isHiddenFromActionTracker,
  statusOptionsForTypeKind
} from "./reference-data";

describe("ActionType kind filtering", () => {
  it("defines exactly three BR type names", () => {
    expect(BR_ACTION_TYPE_NAMES).toEqual(["City BR", "Cayo BR", "Sandy BR"]);
  });

  it("returns BR-only status options for br kind", () => {
    expect(statusOptionsForTypeKind("br")).toEqual([
      "Completed",
      "Actions Didn't Attend"
    ]);
  });

  it("returns full status options for action kind", () => {
    const options = statusOptionsForTypeKind("action");
    expect(options).toEqual([
      "Completed",
      "Actions Didn't Attend",
      "Org 1 Didn't Attend",
      "Org 2 Didn't Attend",
      "Gang Didn't Attend",
      "PD Didn't Attend"
    ]);
  });

  it("defaults to action status options when kind omitted", () => {
    expect(statusOptionsForTypeKind()).toEqual(statusOptionsForTypeKind("action"));
  });
});

describe("Action tracker type filtering", () => {
  it("defines meeting types hidden from action tracker", () => {
    expect(TRACKER_HIDDEN_ACTION_TYPE_NAMES).toEqual([
      "Actions Meeting",
      "Staff Meeting"
    ]);
  });

  it("hides meeting types from action tracker (case-insensitive)", () => {
    expect(isHiddenFromActionTracker("Actions Meeting")).toBe(true);
    expect(isHiddenFromActionTracker("actions meeting")).toBe(true);
    expect(isHiddenFromActionTracker("Staff Meeting")).toBe(true);
    expect(isHiddenFromActionTracker("Raid")).toBe(false);
  });

  it("filterTypesForActionTracker keeps schedule-only types out of tracker list", () => {
    const types = [
      { name: "Raid", colourHex: "#fff" },
      { name: "Actions Meeting", colourHex: "#eee" },
      { name: "Staff Meeting", colourHex: "#ddd" },
      { name: "Deal", colourHex: "#ccc" }
    ];
    expect(filterTypesForActionTracker(types).map(t => t.name)).toEqual(["Raid", "Deal"]);
  });

  it("does not hide BR types from schedule (filter is action-tracker only)", () => {
    const types = [
      { name: "Raid", colourHex: "#fff" },
      { name: "City BR", colourHex: "#eee" },
      { name: "Cayo BR", colourHex: "#ddd" }
    ];
    expect(filterTypesForActionTracker(types).map(t => t.name)).toEqual(["Raid", "City BR", "Cayo BR"]);
  });
});
