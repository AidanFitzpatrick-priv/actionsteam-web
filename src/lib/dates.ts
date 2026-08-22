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

/** YYYY-MM-DD in the given IANA zone (default Europe/London). */
export function formatYmdInZone(d: Date, timeZone = "Europe/London"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(d);
}

function tzOffsetMsAt(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "0";
  const hourRaw = Number(get("hour"));
  const hour = hourRaw === 24 ? 0 : hourRaw;
  const asUtc = Date.UTC(
    Number(get("year")),
    Number(get("month")) - 1,
    Number(get("day")),
    hour,
    Number(get("minute")),
    Number(get("second"))
  );
  return asUtc - date.getTime();
}

function nextCalendarYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** UTC instant of local midnight for a YYYY-MM-DD calendar date in `timeZone`. */
export function zonedMidnightUtc(ymd: string, timeZone = "Europe/London"): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const offset = tzOffsetMsAt(noonUtc, timeZone);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - offset);
}

/** Inclusive start / exclusive end of the London calendar day containing `now`. */
export function londonDayRangeUtc(now = new Date()): { start: Date; end: Date; ymd: string } {
  const ymd = formatYmdInZone(now, "Europe/London");
  const start = zonedMidnightUtc(ymd, "Europe/London");
  const end = zonedMidnightUtc(nextCalendarYmd(ymd), "Europe/London");
  return { start, end, ymd };
}
