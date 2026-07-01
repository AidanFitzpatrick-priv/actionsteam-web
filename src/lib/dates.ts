/** Port of Utils.js date helpers — store ISO in DB, display DD/MM/YYYY. */

export function parseDate(input: unknown): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;

  let str = String(input).trim();
  if (!str) return null;

  str = str.replace(/\./g, "/").replace(/-/g, "/");
  const parts = str.split("/");

  if (parts.length !== 3) {
    const dTry = new Date(str);
    return isNaN(dTry.getTime()) ? null : dTry;
  }

  let a = parseInt(parts[0], 10);
  let b = parseInt(parts[1], 10);
  let y = parseInt(parts[2], 10);
  if (isNaN(a) || isNaN(b) || isNaN(y)) return null;
  if (y < 100) y = 2000 + y;

  let m: number;
  let d: number;
  // UK DD/MM: day-first when unambiguous; default DD/MM when both parts ≤ 12.
  if (a > 12) {
    d = a;
    m = b;
  } else if (b > 12) {
    m = a;
    d = b;
  } else {
    d = a;
    m = b;
  }

  const date = new Date(y, m - 1, d, 12, 0, 0);
  return isNaN(date.getTime()) ? null : date;
}

export function isSameYMD(d1: Date | null, d2: Date | null): boolean {
  if (!d1 || !d2) return false;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export function formatDateUK(d: Date | null | undefined): string {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function formatDateUKShort(d: Date | null | undefined): string {
  if (!d) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
}

export function parseTimeMinutes(raw: string | null | undefined): number {
  const s = String(raw ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return 9999;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}
