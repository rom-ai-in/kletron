import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import path from "node:path";

const REQUIRED_TOOLS = [
  "list_files",
  "read_file",
  "read_file_range",
  "search_code",
  "repo_metrics",
  "todo_search",
  "dependency_info",
  "describe_structure",
  "git_log",
  "git_diff",
  "git_grep",
  "git_blame",
  "structural_search",
  "symbols_list",
  "find_symbol",
  "go_to_definition",
  "references",
  "web_search",
  "fetch_url",
  "github_api",
  "bootstrap_context",
  "locate_ui_feature",
  "str_replace_editor",
  "execute_bash",
  "output_format",
];

test("server registers expected tools via tools/list", async () => {
  const serverPath = path.resolve(process.cwd(), "server.js");
  const child = spawn(process.execPath, [serverPath, "--mcp"], { stdio: ["pipe", "pipe", "pipe"] });

  let buffer = "";
  const messages = [];

  child.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      try {
        messages.push(JSON.parse(line));
      } catch {
        // ignore
      }
    }
  });

  const init = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0.0" } },
  };
  const initialized = { jsonrpc: "2.0", method: "notifications/initialized", params: {} };
  const list = { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} };

  child.stdin.write(`${JSON.stringify(init)}\n`);

  const tools = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout waiting for tools/list")), 10_000);
    let sentList = false;
    const interval = setInterval(() => {
      const initOk = messages.find((m) => m.id === 1 && m.result?.protocolVersion);
      if (initOk && !sentList) {
        sentList = true;
        child.stdin.write(`${JSON.stringify(initialized)}\n`);
        child.stdin.write(`${JSON.stringify(list)}\n`);
      }
      const toolsMsg = messages.find((m) => m.id === 2 && Array.isArray(m.result?.tools));
      if (toolsMsg) {
        clearTimeout(timeout);
        clearInterval(interval);
        resolve(toolsMsg.result.tools);
      }
    }, 50);
  });

  const names = new Set(tools.map((t) => t.name));
  for (const toolName of REQUIRED_TOOLS) {
    assert.ok(names.has(toolName), `missing tool: ${toolName}`);
  }

  child.kill("SIGKILL");
});
