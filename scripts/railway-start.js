/**
 * Production start for Railway:
 * 1. Apply schema (prisma db push) — must complete before serving DB-backed routes
 * 2. Start Next.js
 * 3. Start 12h backup scheduler (BACKUP_ENABLED !== false)
 */
const { execSync, spawn } = require("child_process");

const port = process.env.PORT || "3000";
const BACKUP_INTERVAL_MS = 12 * 60 * 60 * 1000;

if (!process.env.DATABASE_URL) {
  console.error(
    "[start] DATABASE_URL is not set.\n" +
      "  Railway → web service → Variables → Add Reference → Postgres → DATABASE_URL"
  );
  process.exit(1);
}

try {
  console.log("[start] Applying database schema…");
  execSync("npx prisma db push --accept-data-loss --skip-generate", {
    stdio: "inherit",
    env: process.env
  });
  console.log("[start] Database schema applied.");
  try {
    console.log("[start] Ensuring BR action types…");
    execSync("npx tsx scripts/bootstrap-br-types.ts", {
      stdio: "inherit",
      env: process.env
    });
  } catch (err) {
    console.error("[start] BR type bootstrap failed:", err.message ?? err);
    process.exit(1);
  }
} catch (err) {
  console.error("[start] prisma db push failed:", err.message ?? err);
  process.exit(1);
}

function runScheduledBackupJob() {
  const child = spawn("npx", ["tsx", "scripts/scheduled-backup.ts"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
    detached: false
  });
  child.on("error", err => console.error("[backup] Scheduler spawn failed:", err));
}

function startBackupScheduler() {
  if (process.env.BACKUP_ENABLED === "false") {
    console.log("[backup] Scheduler disabled (BACKUP_ENABLED=false)");
    return;
  }
  console.log("[backup] Scheduler enabled — every 12 hours, max 4 retained");
  runScheduledBackupJob();
  setInterval(runScheduledBackupJob, BACKUP_INTERVAL_MS);
}

console.log(`[start] Starting Next.js on 0.0.0.0:${port}…`);
const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

startBackupScheduler();

child.on("exit", code => process.exit(code ?? 0));
