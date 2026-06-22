/**
 * Port of ScheduleLayout.js — parse exported schedule CSV grid into slot records.
 * Mapping: findScheduleWeekBlocks_ → parseScheduleDayBlocks_
 */
import { SCHEDULE } from "./config";
import { parseDate } from "./dates";

export type ParsedScheduleSlot = {
  weekIndex: number;
  dayIndex: number;
  rowIndex: number;
  timeText: string | null;
  typeName: string | null;
  actionDayDate: Date | null;
  dateBooked: Date | null;
  bookedBy: string | null;
  orgName: string | null;
};

export type DayColumns = {
  blueCol: number;
  timeCol: number;
  typeCol: number;
  dateBookedCol: number;
  bookedByCol: number;
  orgCol: number;
};

function cell(grid: string[][], row: number, col: number): string {
  const r = grid[row];
  if (!r || col < 0 || col >= r.length) return "";
  return String(r[col] ?? "").trim();
}

/** parseScheduleDayBlocks_ (0-based column indices) */
export function parseScheduleDayBlocks(headerValues: string[]): DayColumns[] {
  const header = headerValues.map(h => String(h ?? "").trim().toLowerCase());
  const days: DayColumns[] = [];
  const seenBlue = new Set<number>();

  for (let i = 0; i < header.length; i++) {
    if (header[i] !== "type of action") continue;
    const typeCol = i;
    const blueCol = typeCol - 2;
    if (blueCol < 0 || seenBlue.has(blueCol)) continue;
    seenBlue.add(blueCol);

    const blockStart = blueCol;
    const slice = header.slice(blockStart, Math.min(header.length, blockStart + SCHEDULE.COLS_PER_DAY));
    const findCol = (re: RegExp) => {
      const idx = slice.findIndex(h => re.test(h));
      return idx === -1 ? null : blockStart + idx;
    };

    days.push({
      blueCol,
      timeCol: typeCol - 1,
      typeCol,
      dateBookedCol: findCol(/^date booked$/) ?? typeCol + 1,
      bookedByCol: findCol(/^booked by$/) ?? typeCol + 2,
      orgCol: findCol(/^org name$/) ?? typeCol + 3
    });
  }

  if (!days.length) {
    for (let tc = 2; tc < header.length; tc += SCHEDULE.COLS_PER_DAY) {
      days.push({
        blueCol: tc - 2,
        timeCol: tc - 1,
        typeCol: tc,
        dateBookedCol: tc + 1,
        bookedByCol: tc + 2,
        orgCol: tc + 3
      });
    }
  }

  return days;
}

function findScheduleColumnHeaderRow(grid: string[][]): number {
  const scanRows = Math.min(80, grid.length);
  for (let r = 0; r < scanRows; r++) {
    const row = grid[r].map(h => String(h ?? "").trim().toLowerCase());
    if (row.includes("type of action") && row.includes("time")) return r;
  }
  return 2;
}

/** findScheduleWeekBlocks_ */
function findScheduleWeekBlocks(grid: string[][]): Array<{ weekRow: number; startRow: number; numRows: number }> {
  const lastRow = grid.length;
  const blocks: Array<{ weekRow: number; startRow: number; numRows: number }> = [];

  for (let i = 0; i < lastRow; i++) {
    const text = cell(grid, i, 0);
    if (!/^week\s*\d+/i.test(text)) continue;
    const dataStart = i + SCHEDULE.HEADER_ROWS;
    if (dataStart >= lastRow) continue;
    const numRows = Math.min(SCHEDULE.DATA_ROWS, lastRow - dataStart);
    if (numRows > 0) blocks.push({ weekRow: i, startRow: dataStart, numRows });
  }

  if (blocks.length) return blocks;

  for (let blockStart = 0; blockStart < lastRow; blockStart += SCHEDULE.ROWS_PER_WEEK) {
    const dataStart = blockStart + SCHEDULE.HEADER_ROWS;
    if (dataStart >= lastRow) continue;
    const numRows = Math.min(SCHEDULE.DATA_ROWS, lastRow - dataStart);
    if (numRows > 0) blocks.push({ weekRow: blockStart, startRow: dataStart, numRows });
  }

  return blocks;
}

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/** Extract all slots from a schedule sheet CSV export. */
export function parseScheduleCsv(content: string): ParsedScheduleSlot[] {
  const grid = parseCsv(content);
  if (!grid.length) return [];

  const headerRow = findScheduleColumnHeaderRow(grid);
  const globalDays = parseScheduleDayBlocks(grid[headerRow] ?? []);
  const blocks = findScheduleWeekBlocks(grid);
  const slots: ParsedScheduleSlot[] = [];

  blocks.forEach((block, weekIndex) => {
    const blockHeaderRow = block.weekRow + SCHEDULE.HEADER_ROWS - 1;
    const headerValues = grid[blockHeaderRow] ?? grid[headerRow] ?? [];
    const days = parseScheduleDayBlocks(headerValues);
    const activeDays = days.length ? days : globalDays;

    activeDays.forEach((day, dayIndex) => {
      const actionDayDate = parseDate(cell(grid, blockHeaderRow, day.blueCol));
      for (let ri = 0; ri < block.numRows; ri++) {
        const sheetRow = block.startRow + ri;
        const timeText = cell(grid, sheetRow, day.timeCol) || null;
        const typeName = cell(grid, sheetRow, day.typeCol) || null;
        const bookedRaw = cell(grid, sheetRow, day.dateBookedCol);
        const bookedBy = cell(grid, sheetRow, day.bookedByCol) || null;
        const orgName = cell(grid, sheetRow, day.orgCol) || null;
        const dateBooked = bookedRaw ? parseDate(bookedRaw) : null;

        slots.push({
          weekIndex,
          dayIndex,
          rowIndex: ri,
          timeText,
          typeName,
          actionDayDate,
          dateBooked,
          bookedBy,
          orgName: orgName || null
        });
      }
    });
  });

  return slots;
}

/** "June Actions Schedule" → "June" */
export function monthNameFromScheduleFilename(path: string): string {
  const base = path.replace(/\\/g, "/").split("/").pop() ?? path;
  const m = base.match(/-\s*(.+?)\s+Actions Schedule\.csv$/i);
  return m ? m[1].trim() : "Imported";
}
