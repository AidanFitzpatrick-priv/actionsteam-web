/** Port of Utils.js name helpers. */

export function cleanName(raw: unknown): string {
  if (!raw) return "";
  let s = String(raw).trim().toLowerCase();
  if (s.includes("-")) s = s.split("-")[0].trim();
  return s;
}

export function splitPeopleList(raw: unknown): string[] {
  return String(raw ?? "")
    .split(/[,;\n]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function normalizeStatus(raw: unknown): Set<string> {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map(s => s.trim().toLowerCase().replace(/\s+/g, " "))
      .filter(Boolean)
  );
}

export function slugifyMonth(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
