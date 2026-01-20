import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export async function runGit({ cwd, args, timeoutMs = 10_000, maxBuffer = 1024 * 1024 }) {
  try {
    const { stdout } = await execFileAsync("git", args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer,
    });
    return stdout;
  } catch (error) {
    const message = error?.stderr ? String(error.stderr) : error?.message ? String(error.message) : "Unknown git error";
    throw new Error(message.trim() || "Git command failed.");
  }
}

export async function ensureGitRepo({ cwd }) {
  const stdout = await runGit({ cwd, args: ["rev-parse", "--is-inside-work-tree"] });
  if (!stdout.trim().startsWith("true")) {
    throw new Error("Target path is not a Git working tree.");
  }
}

