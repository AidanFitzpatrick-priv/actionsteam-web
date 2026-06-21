/**
 * Nightly backup — logical JSON export + backups table row.
 * Production: replace file write with pg_dump → encrypted object storage.
 */
import { runBackup } from "../src/services/backups";

async function main() {
  const record = await runBackup({ createdBy: "system", kind: "nightly" });
  console.log("Backup recorded:", record.storageKey);
}

main().catch(console.error).finally(async () => {
  const { prisma } = await import("../src/lib/db");
  await prisma.$disconnect();
});
