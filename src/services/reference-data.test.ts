import { describe, expect, it } from "vitest";
import {
  BR_ACTION_TYPE_NAMES,
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
