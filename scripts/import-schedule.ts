/**
 * CLI: npm run import:schedule -- import-data/june-schedule.csv --month June --set-active
 */
import path from "path";
import { PrismaClient } from "@prisma/client";
import { monthNameFromScheduleFilename } from "../src/lib/schedule-csv-import";
import { runScheduleCsvImport } from "../src/services/import-schedule";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const csvArg = args.find(a => !a.startsWith("--"));
  if (!csvArg) {
    console.error("Usage: npm run import:schedule -- <csv> [--month June] [--set-active] [--skip-reference]");
    process.exit(1);
  }

  const csvPath = path.resolve(csvArg);
  const monthFlag = args.indexOf("--month");
  const monthName =
    monthFlag >= 0 && args[monthFlag + 1]
      ? args[monthFlag + 1]
      : monthNameFromScheduleFilename(csvPath);

  console.log(`Reading: ${csvPath}`);
  const result = await runScheduleCsvImport({
    csvPath,
    monthName,
    setActive: args.includes("--set-active"),
    withReference: !args.includes("--skip-reference")
  });

  console.log(`Reference: ${result.reference.typesCount} types, ${result.reference.gangsCount} gangs`);
  console.log(`Parsed ${result.parsed} cells → updated ${result.updated} slots, synced ${result.synced} tracker rows`);
  console.log(`Open /months/${result.month.slug}/schedule`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
