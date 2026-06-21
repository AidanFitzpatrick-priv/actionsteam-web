/**
 * Production start for Railway — bind to PORT, run Next.js.
 * Schema is applied via railway.toml preDeployCommand (prisma db push).
 */
const { spawn } = require("child_process");

const port = process.env.PORT || "3000";
const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env
});

child.on("exit", code => process.exit(code ?? 0));
