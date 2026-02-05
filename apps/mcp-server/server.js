import "dotenv/config";

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import path from "path";
import http from "http";
import { URL } from "url";

import { listFiles } from "./tools/listFiles.js";
import { readFile } from "./tools/readFile.js";
import { readFileRange } from "./tools/readFileRange.js";
import { searchCode } from "./tools/searchCode.js";
import { repoMetrics } from "./tools/repoMetrics.js";
import { todoSearch } from "./tools/todoSearch.js";
import { dependencyInfo } from "./tools/dependencyInfo.js";
import { describeStructure } from "./tools/describeStructure.js";
import { gitLog } from "./tools/gitLog.js";
import { gitDiff } from "./tools/gitDiff.js";
import { gitGrep } from "./tools/gitGrep.js";
import { gitBlame } from "./tools/gitBlame.js";
import { structuralSearch } from "./tools/structuralSearch.js";
import { symbolsList } from "./tools/symbolsList.js";
import { findSymbol } from "./tools/findSymbol.js";
import { goToDefinition } from "./tools/goToDefinition.js";
import { references } from "./tools/references.js";
import { webSearch } from "./tools/webSearch.js";
import { fetchUrl } from "./tools/fetchUrl.js";
import { githubApi } from "./tools/githubApi.js";
import { bootstrapContext } from "./tools/bootstrapContext.js";
import { locateUiFeature } from "./tools/locateUiFeature.js";
import { strReplaceEditor } from "./tools/strReplaceEditor.js";
import { executeBash } from "./tools/executeBash.js";
import { outputFormat } from "./tools/outputFormat.js";
import { writeFile } from "./tools/writeFile.js";
import { loadSkill, listSkills } from "./tools/skillLoader.js";
import { config } from "./config.js";

const argv = process.argv.slice(2);
const hasArg = (flag) => argv.includes(flag);

const MODE = (() => {
  if (hasArg("--diagnostic") || hasArg("--doctor")) return "diagnostic";
  if (hasArg("--mcp")) return "mcp";
  return "auto";
})();

// Determine if running in interactive mode (Terminal) vs Pipe (LM Studio)
// NOTE: Some tools (e.g. LM Studio) can launch servers with a pseudo-TTY.
// Use `--mcp` / `--diagnostic` to force a mode and avoid accidental exits.
const isInteractive = Boolean(process.stdin.isTTY);

if (MODE === "diagnostic") {
  runDiagnostic();
} else if (MODE === "mcp") {
  runServer();
} else if (isInteractive) {
  runDiagnostic();
} else {
  runServer();
}

/**
 * PRODUCTION MODE: Runs the MCP Server
 */
async function runServer() {
  const allTools = buildAllTools();

  const transportMode = (process.env.MCP_TRANSPORT || process.env.GITHUB_MCP_TRANSPORT || "stdio")
    .toLowerCase()
    .trim();

  if (transportMode === "sse" || transportMode === "http") {
    const portRaw = process.env.MCP_PORT || process.env.GITHUB_MCP_PORT || "9000";
    const port = Number(portRaw);
    if (!Number.isFinite(port) || port <= 0) {
      throw new Error(`Invalid MCP_PORT: ${portRaw}`);
    }
    await runSseServer({ allTools, port });
    return;
  }

  const server = new Server(
    {
      name: "mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  wireToolHandlers({ server, allTools });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function buildAllTools() {
  const tools = {
    list_files: listFiles,
    read_file: readFile,
    read_file_range: readFileRange,
    search_code: searchCode,
  };

  const advancedTools = {
    repo_metrics: repoMetrics,
    todo_search: todoSearch,
    dependency_info: dependencyInfo,
    describe_structure: describeStructure,
    git_log: gitLog,
    git_diff: gitDiff,
    git_grep: gitGrep,
    git_blame: gitBlame,
    structural_search: structuralSearch,
    symbols_list: symbolsList,
    find_symbol: findSymbol,
    go_to_definition: goToDefinition,
    references,
    web_search: webSearch,
    fetch_url: fetchUrl,
    github_api: githubApi,
    bootstrap_context: bootstrapContext,
    locate_ui_feature: locateUiFeature,
    write_file: writeFile,

    // Compatibility shims for common agent toolsets (read-only / safe emulation).
    str_replace_editor: strReplaceEditor,
    execute_bash: executeBash,
    output_format: outputFormat,

    // Skills system
    load_skill: loadSkill,
    list_skills: listSkills,
  };

  return { ...tools, ...advancedTools };
}

function wireToolHandlers({ server, allTools }) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.entries(allTools).map(([name, tool]) => ({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    const tool = allTools[toolName];

    if (!tool) {
      throw new Error(`Tool not found: ${toolName}`);
    }

    try {
      const result = await tool.run(request.params.arguments);
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  });
}

async function runSseServer({ allTools, port }) {
  const sessions = new Map();

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

      if (req.method === "GET" && url.pathname === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify(
            {
              ok: true,
              name: "mcp-server",
              version: "1.0.0",
              transport: "sse",
              defaultDir: config.defaultDir ?? null,
              tools: Object.keys(allTools).length,
            },
            null,
            2
          )
        );
        return;
      }

      if (req.method === "GET" && url.pathname === "/sse") {
        const transport = new SSEServerTransport("/message", res);
        const mcpServer = new Server(
          { name: "mcp-server", version: "1.0.0" },
          { capabilities: { tools: {} } }
        );

        wireToolHandlers({ server: mcpServer, allTools });

        const sessionId = transport.sessionId;
        sessions.set(sessionId, transport);
        mcpServer.onclose = () => {
          sessions.delete(sessionId);
        };

        await mcpServer.connect(transport);
        return;
      }

      if (req.method === "POST" && url.pathname === "/message") {
        const sessionId = url.searchParams.get("sessionId");
        if (!sessionId) {
          res.writeHead(400).end("Missing sessionId");
          return;
        }
        const transport = sessions.get(sessionId);
        if (!transport) {
          res.writeHead(404).end("Session not found");
          return;
        }
        await transport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(404).end("Not found");
    } catch (error) {
      res.writeHead(500).end(String(error?.message || error));
    }
  });

  server.listen(port, () => {
    console.log(`MCP server running on http://localhost:${port}/sse`);
  });
}

/**
 * DIAGNOSTIC MODE: Runs a self-test with pretty output
 */
function runDiagnostic() {
  const __filename = fileURLToPath(import.meta.url);
  const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    green: "\x1b[32m",
    cyan: "\x1b[36m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
  };

  console.log(`${colors.cyan}${colors.bright}
┌──────────────────────────────────────────────────┐
│          MCP Server Diagnostic Tool 🕵️‍♂️           │
└──────────────────────────────────────────────────┘${colors.reset}\n`);

  console.log(`${colors.yellow}➤ Démarrage du serveur en mode test...${colors.reset}`);

  // Spawn itself, but piping stdio so the child sees !isTTY and runs runServer()
  const serverProcess = spawn(process.execPath, [__filename, "--mcp"], {
    stdio: ["pipe", "pipe", "inherit"],
    env: {
      ...process.env,
      MCP_TRANSPORT: "stdio",
      GITHUB_MCP_TRANSPORT: "stdio",
      MCP_PORT: "",
      GITHUB_MCP_PORT: "",
    },
  });

  serverProcess.on("exit", (code, signal) => {
    if (code !== 0) {
      console.log(
        `\n${colors.red}❌ Le serveur enfant s'est arrêté (code=${code}, signal=${signal || "n/a"}).${colors.reset}`
      );
    }
  });

  const initMessage = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "inspector", version: "1.0.0" }
    }
  };

  const listToolsMessage = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };

  const initializedNotification = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
    params: {}
  };

  let step = 0;
  let seenListRequest = false;
  let stdoutBuffer = "";

  serverProcess.stdout.on("data", (data) => {
    stdoutBuffer += data.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);

        if (step === 0 && json.result && json.result.protocolVersion) {
          console.log(`${colors.green}✔ Serveur connecté et initialisé.${colors.reset}`);
          console.log(`${colors.yellow}➤ Récupération de la liste des outils...${colors.reset}`);
          // MCP requires the client to send an initialized notification before other requests.
          serverProcess.stdin.write(JSON.stringify(initializedNotification) + "\n");
          serverProcess.stdin.write(JSON.stringify(listToolsMessage) + "\n");
          seenListRequest = true;
          step++;
        }
        else if (step === 1 && json.result && json.result.tools) {
          console.log(`\n${colors.cyan}${colors.bright}🔧 Outils disponibles (${json.result.tools.length}) :${colors.reset}`);

          json.result.tools.forEach(tool => {
            console.log(`\n  ${colors.green}• ${tool.name}${colors.reset}`);
            console.log(`    ${colors.blue}${tool.description}${colors.reset}`);
          });

          console.log(`\n${colors.green}${colors.bright}✨ Succès ! Le serveur fonctionne parfaitement.${colors.reset}`);
          console.log(`${colors.reset}👉 Configurez LM Studio avec la commande : ${colors.bright}npm start${colors.reset} (ou 'node server.js')\n`);
          serverProcess.kill();
          process.exit(0);
        }
        else if (seenListRequest && json.error) {
          console.log(`\n${colors.red}❌ Erreur MCP: ${colors.reset}${JSON.stringify(json.error)}`);
          serverProcess.kill();
          process.exit(1);
        }
      } catch (err) {
        // Ignore non-JSON
      }
    }
  });

  serverProcess.stdin.write(JSON.stringify(initMessage) + "\n");

  setTimeout(() => {
    console.log(`\n${colors.red}❌ Timeout : Le serveur ne répond pas.${colors.reset}`);
    serverProcess.kill();
    process.exit(1);
  }, 60000);
}
