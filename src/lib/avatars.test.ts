import { describe, expect, it } from "vitest";
import { parseAvatarDataUrl } from "./avatars";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("parseAvatarDataUrl", () => {
  it("accepts a PNG data URL", () => {
    const { buf, mime } = parseAvatarDataUrl(`data:image/png;base64,${PNG_1X1}`);
    expect(mime).toBe("image/png");
    expect(buf.length).toBeGreaterThan(8);
  });

  it("rejects non-images", () => {
    expect(() => parseAvatarDataUrl("data:text/plain;base64,aaaa")).toThrow(/JPEG, PNG, WebP, or GIF/);
  });
});
