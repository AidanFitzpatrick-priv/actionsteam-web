const MAX_BYTES = 2 * 1024 * 1024;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif"
};

function sniff(buf: Buffer): keyof typeof MIME | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "gif";
  if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  return null;
}

export function parseAvatarDataUrl(dataUrl: string): { buf: Buffer; mime: string } {
  const match = String(dataUrl || "").match(
    /^data:image\/(jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) {
    throw new Error("Choose a JPEG, PNG, WebP, or GIF image");
  }
  const buf = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buf.length) throw new Error("Choose a JPEG, PNG, WebP, or GIF image");
  if (buf.length > MAX_BYTES) throw new Error("Image must be under 2 MB");
  const ext = sniff(buf);
  if (!ext) throw new Error("That file is not a valid image");
  return { buf, mime: MIME[ext] };
}
