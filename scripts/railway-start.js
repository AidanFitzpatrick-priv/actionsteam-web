/**
 * Production start for Railway:
 * 1. Verify DATABASE_URL
 * 2. Apply schema (prisma db push)
 * 3. Start Next.js on PORT
 */
const { execSync, spawn } = require("child_process");

const port = process.env.PORT || "3000";

if (!process.env.DATABASE_URL) {
  console.error(
    "[start] DATABASE_URL is not set.\n" +
      "  Railway → your web service → Variables → Add Reference → Postgres → DATABASE_URL"
  );
  process.exit(1);
}

console.log("[start] Applying database schema…");
try {
  execSync("npx prisma db push --skip-generate", {
    stdio: "inherit",
    env: process.env
  });
} catch {
  console.error("[start] prisma db push failed — check DATABASE_URL and Postgres is running.");
  process.exit(1);
}

console.log(`[start] Starting Next.js on port ${port}…`);
const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

child.on("exit", code => process.exit(code ?? 0));
