/**
 * Production start for Railway:
 * 1. Apply schema (prisma db push) — must complete before serving DB-backed routes
 * 2. Start Next.js
 */
const { execSync, spawn } = require("child_process");

const port = process.env.PORT || "3000";

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
} catch (err) {
  console.error("[start] prisma db push failed:", err.message ?? err);
  process.exit(1);
}

console.log(`[start] Starting Next.js on 0.0.0.0:${port}…`);
const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

child.on("exit", code => process.exit(code ?? 0));
