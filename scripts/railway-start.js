/**
 * Production start for Railway:
 * 1. Start Next.js immediately (so healthcheck can reach PORT)
 * 2. Apply schema in background (prisma db push)
 */
const { exec, spawn } = require("child_process");

const port = process.env.PORT || "3000";

if (!process.env.DATABASE_URL) {
  console.error(
    "[start] DATABASE_URL is not set.\n" +
      "  Railway → web service → Variables → Add Reference → Postgres → DATABASE_URL"
  );
  process.exit(1);
}

console.log(`[start] Starting Next.js on 0.0.0.0:${port}…`);
const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

child.on("exit", code => process.exit(code ?? 0));

console.log("[start] Applying database schema in background…");
exec("npx prisma db push --skip-generate", { env: process.env }, (err, stdout, stderr) => {
  if (err) {
    console.error("[start] prisma db push failed:", stderr || err.message);
    return;
  }
  console.log("[start] Database schema applied.");
});
