/**
 * Import schedule + reference data from CSV (Sheet export format).
 * Used by scripts/import-schedule.ts and admin tools API.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/db";
import { parseScheduleCsv, type ParsedScheduleSlot } from "@/lib/schedule-csv-import";
import { slugifyMonth } from "@/lib/names";
import { SCHEDULE } from "@/lib/config";
import { syncScheduleSlotToTracker } from "@/services/schedule-sync";

const DEFAULT_TYPE_COLORS = [
  "#fce5cd", "#d9ead3", "#cfe2f3", "#f4cccc", "#fff2cc", "#d9d2e9", "#ead1dc", "#c9daf8"
];

async function importReferenceDataIfPresent() {
  const dataDir = path.join(process.cwd(), "import-data");
  const typesFile = path.join(dataDir, "action-types.csv");
  const gangsFile = path.join(dataDir, "gangs.csv");

  let typesCount = 0;
  let gangsCount = 0;

  if (existsSync(typesFile)) {
    const lines = readFileSync(typesFile, "utf8")
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    for (const name of lines) {
      if (/^type/i.test(name)) continue;
      await prisma.actionType.upsert({
        where: { name },
        create: { name, colourHex: DEFAULT_TYPE_COLORS[typesCount % DEFAULT_TYPE_COLORS.length] },
        update: {}
      });
      typesCount++;
    }
  }

  if (existsSync(gangsFile)) {
    const lines = readFileSync(gangsFile, "utf8").split(/\r?\n/).slice(1);
    for (const line of lines) {
      const name = line.split(",")[0]?.trim();
      if (!name || name.toLowerCase() === "gang name") continue;
      await prisma.gang.upsert({
        where: { name },
        create: { name, org2Eligible: true },
        update: { deletedAt: null }
      });
      gangsCount++;
    }
  }

  return { typesCount, gangsCount };
}

async function ensureMonth(name: string, setActive: boolean) {
  const slug = slugifyMonth(name);
  let month = await prisma.month.findUnique({ where: { slug } });

  if (!month) {
    month = await prisma.month.create({ data: { name, slug, isActive: setActive } });
  } else if (setActive) {
    await prisma.month.updateMany({ data: { isActive: false } });
    month = await prisma.month.update({ where: { id: month.id }, data: { isActive: true } });
  }

  return month;
}

async function ensureSlotCapacity(monthId: string, slots: ParsedScheduleSlot[]) {
  const maxWeek = Math.max(0, ...slots.map(s => s.weekIndex));
  const neededWeeks = maxWeek + 1;

  for (let w = 0; w < neededWeeks; w++) {
    for (let d = 0; d < SCHEDULE.DAYS_PER_WEEK; d++) {
      for (let r = 0; r < SCHEDULE.DATA_ROWS; r++) {
        await prisma.scheduleSlot.upsert({
          where: {
            monthId_weekIndex_dayIndex_rowIndex: {
              monthId,
              weekIndex: w,
              dayIndex: d,
              rowIndex: r
            }
          },
          create: { monthId, weekIndex: w, dayIndex: d, rowIndex: r },
          update: {}
        });
      }
    }
  }
}

async function importSlots(monthId: string, slots: ParsedScheduleSlot[]) {
  let updated = 0;
  let synced = 0;

  for (const s of slots) {
    const hasData = s.typeName || s.orgName || s.bookedBy || s.dateBooked || s.timeText;
    if (!hasData) continue;

    const slot = await prisma.scheduleSlot.findUnique({
      where: {
        monthId_weekIndex_dayIndex_rowIndex: {
          monthId,
          weekIndex: s.weekIndex,
          dayIndex: s.dayIndex,
          rowIndex: s.rowIndex
        }
      }
    });
    if (!slot) continue;

    const updatedSlot = await prisma.scheduleSlot.update({
      where: { id: slot.id },
      data: {
        timeText: s.timeText,
        typeName: s.typeName,
        dateBooked: s.dateBooked,
        bookedBy: s.bookedBy,
        orgName: s.orgName,
        deletedAt: null
      }
    });
    updated++;

    if (updatedSlot.typeName && updatedSlot.orgName) {
      await syncScheduleSlotToTracker(updatedSlot.id);
      synced++;
    }
  }

  return { updated, synced };
}

export async function runScheduleCsvImport(options: {
  csvPath: string;
  monthName: string;
  setActive?: boolean;
  withReference?: boolean;
}) {
  const csvPath = path.resolve(options.csvPath);
  const content = readFileSync(csvPath, "utf8");
  const parsed = parseScheduleCsv(content);

  let reference = { typesCount: 0, gangsCount: 0 };
  if (options.withReference !== false) {
    reference = await importReferenceDataIfPresent();
  }

  const month = await ensureMonth(options.monthName, options.setActive ?? false);
  await ensureSlotCapacity(month.id, parsed);
  const { updated, synced } = await importSlots(month.id, parsed);

  return {
    month: { id: month.id, name: month.name, slug: month.slug },
    parsed: parsed.length,
    updated,
    synced,
    reference
  };
}

/** Bundled export from Google Sheets (import-data/june-schedule.csv). */
export async function importBundledJuneSchedule() {
  const csvPath = path.join(process.cwd(), "import-data", "june-schedule.csv");
  if (!existsSync(csvPath)) {
    throw new Error("import-data/june-schedule.csv not found in deployment");
  }
  return runScheduleCsvImport({
    csvPath,
    monthName: "June",
    setActive: true,
    withReference: true
  });
}
