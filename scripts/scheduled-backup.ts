/**
 * Scheduled backup runner — checks 12h interval, prunes to max 4.
 * Invoked on startup and every 12h from scripts/railway-start.js (BACKUP_ENABLED !== false).
 * Note: backups/ on Railway is ephemeral unless a volume is mounted.
 */
import { runScheduledBackupIfDue, runBackup } from "../src/services/backups";

async function main() {
  const force = process.argv.includes("--force");
  if (force) {
    const record = await runBackup({ createdBy: "system", kind: "scheduled" });
    console.log("[backup] Forced backup:", record.storageKey);
    return;
  }

  const record = await runScheduledBackupIfDue();
  if (record) {
    console.log("[backup] Scheduled backup:", record.storageKey);
  } else {
    console.log("[backup] Skipped — last backup within 12 hours");
  }
}

main().catch(err => {
  console.error("[backup] Failed:", err);
  process.exit(1);
}).finally(async () => {
  const { prisma } = await import("../src/lib/db");
  await prisma.$disconnect();
});
