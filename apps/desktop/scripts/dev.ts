import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function run(command: string, args: string[], env?: Record<string, string>, cwd: string = root) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env }
  });
  return child;
}

const repoRoot = path.resolve(root, "..", "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const vite = run(
  npmCommand,
  ["exec", "--workspace", "apps/desktop", "--", "vite", "--port", "5173"],
  { DESKTOP_DEV_SERVER_URL: "http://localhost:5173" },
  repoRoot
);
const build = run("npx", ["tsx", "scripts/build.ts"], {});

build.on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }

  const electron = run("npx", ["electron", "dist-electron/main.cjs"], {
    DESKTOP_DEV_SERVER_URL: "http://localhost:5173"
  });

  const shutdown = () => {
    vite.kill();
    electron.kill();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
});
