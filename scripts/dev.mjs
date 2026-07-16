/**
 * Local dev with fixed default port 3040.
 * Override: PORT=3041 node scripts/dev.mjs  (or npm run dev with PORT set)
 */
import { spawn } from "node:child_process";

const port = String(process.env.PORT || 3040);
const child = spawn("npx", ["next", "dev", "-p", port], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
