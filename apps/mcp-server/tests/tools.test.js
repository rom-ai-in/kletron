import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "../..");
const configPath = path.join(projectRoot, "config", "config.json");

async function run(cmd, args, cwd) {
  await execFileAsync(cmd, args, { cwd });
}

async function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf-8");
}

async function makeTempRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "github-mcp-test-"));
  await run("git", ["init"], root);
  await run("git", ["config", "user.email", "test@example.com"], root);
  await run("git", ["config", "user.name", "Test User"], root);
  return root;
}

test("tools: search_code + read_file_range + git + structural + symbols + ts nav", async () => {
  const repoRoot = await makeTempRepo();

  let previousConfig = null;
  try {
    previousConfig = await fs.readFile(configPath, "utf-8");
  } catch {
    previousConfig = null;
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(
    configPath,
    JSON.stringify(
      {
        workingFolder: repoRoot,
        workspaceRoots: [repoRoot],
      },
      null,
      2
    ),
    "utf-8"
  );

  try {
    await writeFile(repoRoot, "a.js", "hello\nworld hello\n");
    await writeFile(repoRoot, "README.md", "# Demo\nThis project supports dark mode via ThemeToggle.\n");
    await writeFile(repoRoot, "lib.ts", "export function foo(): number { return 1; }\n");
    await writeFile(repoRoot, "main.ts", 'import { foo } from "./lib";\nfoo();\n');

    await run("git", ["add", "."], repoRoot);
    await run("git", ["commit", "-m", "init"], repoRoot);

    const { searchCode } = await import("../tools/searchCode.js");
    const { readFileRange } = await import("../tools/readFileRange.js");
    const { gitLog } = await import("../tools/gitLog.js");
    const { gitGrep } = await import("../tools/gitGrep.js");
    const { gitDiff } = await import("../tools/gitDiff.js");
    const { gitBlame } = await import("../tools/gitBlame.js");
    const { structuralSearch } = await import("../tools/structuralSearch.js");
    const { symbolsList } = await import("../tools/symbolsList.js");
    const { findSymbol } = await import("../tools/findSymbol.js");
    const { goToDefinition } = await import("../tools/goToDefinition.js");
    const { references } = await import("../tools/references.js");
    const { fetchUrl } = await import("../tools/fetchUrl.js");
    const { githubApi } = await import("../tools/githubApi.js");
    const { webSearch } = await import("../tools/webSearch.js");
    const { bootstrapContext } = await import("../tools/bootstrapContext.js");
    const { locateUiFeature } = await import("../tools/locateUiFeature.js");
    const { strReplaceEditor } = await import("../tools/strReplaceEditor.js");
    const { executeBash } = await import("../tools/executeBash.js");
    const { outputFormat } = await import("../tools/outputFormat.js");

    const search = await searchCode.run({ path: repoRoot, query: "hello", maxResults: 10 });
    assert.equal(search.matches.length, 2);
    assert.deepEqual(search.matches[0], { file: "a.js", line: 1, column: 1, snippet: "hello" });

    const range = await readFileRange.run({ repoPath: repoRoot, filePath: "a.js", startLine: 2, endLine: 2 });
    assert.equal(range.text.trim(), "world hello");

    const log = await gitLog.run({ path: repoRoot, maxCount: 5 });
    assert.ok(log.length >= 1);

    const grep = await gitGrep.run({ path: repoRoot, query: "hello" });
    assert.ok(grep.matches.some((m) => m.file === "a.js"));

    await writeFile(repoRoot, "a.js", "hello\nchanged hello\n");
    const diff = await gitDiff.run({ path: repoRoot });
    assert.ok(typeof diff.diff === "string");

    const blame = await gitBlame.run({ path: repoRoot, filePath: "a.js", startLine: 1, endLine: 1 });
    assert.equal(blame.lines[0].line, 1);
    assert.ok(blame.lines[0].sha);

    const structural = await structuralSearch.run({
      path: repoRoot,
      pattern: 'import $A from "$B"',
      lang: "ts",
      maxResults: 10,
    });
    assert.ok(structural.matches.some((m) => m.file === "main.ts"));

    const symbols = await symbolsList.run({ path: repoRoot, query: "foo", maxResults: 50 });
    assert.ok(symbols.symbols.some((s) => s.file === "lib.ts" && s.name === "foo" && s.exported === true));

    const found = await findSymbol.run({ path: repoRoot, query: "foo", maxResults: 50 });
    assert.ok(found.symbols.some((s) => s.file === "lib.ts" && s.name === "foo"));

    const mainContent = await fs.readFile(path.join(repoRoot, "main.ts"), "utf-8");
    const col = mainContent.split("\n")[1].indexOf("foo") + 1;
    const def = await goToDefinition.run({ path: repoRoot, filePath: "main.ts", line: 2, column: col });
    assert.ok(def.definitions.some((d) => d.file === "lib.ts"));

    const libContent = await fs.readFile(path.join(repoRoot, "lib.ts"), "utf-8");
    const fooCol = libContent.indexOf("foo") - libContent.lastIndexOf("\n", libContent.indexOf("foo")) + 1;
    const refs = await references.run({ path: repoRoot, filePath: "lib.ts", line: 1, column: fooCol, maxResults: 50 });
    assert.ok(refs.references.some((r) => r.file === "main.ts"));

    // Network tools (optional / safe defaults).
    process.env.MCP_FETCH_ALLOWLIST = "example.com";
    process.env.GITHUB_MCP_FETCH_ALLOWLIST = "example.com";
    const fetched = await fetchUrl.run({ url: "https://example.com", timeoutMs: 15_000, maxBytes: 50_000 });
    assert.equal(fetched.ok, true);
    assert.ok(typeof fetched.text === "string" && fetched.text.length > 0);

    const gh = await githubApi.run({
      repoUrl: "https://github.com/modelcontextprotocol/specification",
      resource: "releases",
      perPage: 1,
      timeoutMs: 20_000,
    });
    assert.ok(Array.isArray(gh));

    if (process.env.TAVILY_API_KEY) {
      const tav = await webSearch.run({ query: "Model Context Protocol MCP", maxResults: 1, timeoutMs: 30_000 });
      assert.ok(tav && typeof tav === "object");
    }

    const ctx = await bootstrapContext.run({ path: repoRoot, maxFiles: 5, maxBytesPerFile: 5_000 });
    assert.ok(ctx.files.some((f) => f.file === "README.md"));

    const located = await locateUiFeature.run({
      path: repoRoot,
      queries: ["dark mode", "ThemeToggle"],
      maxResultsPerQuery: 10,
    });
    assert.ok(located.resultsByQuery["ThemeToggle"].matches.some((m) => m.file === "README.md"));

    const shimRead = await strReplaceEditor.run({ repoPath: repoRoot, path: "README.md", action: "view" });
    assert.equal(shimRead.file, "README.md");
    assert.ok(typeof shimRead.text === "string" && shimRead.text.includes("dark mode"));

    const shimFind = await executeBash.run({ path: repoRoot, command: 'find . -type f -name "*.ts"', maxResults: 50 });
    assert.equal(shimFind.ok, true);
    assert.ok(shimFind.files.some((f) => f.endsWith("lib.ts")));

    const shimGrep = await executeBash.run({ path: repoRoot, command: 'grep -r "ThemeToggle" .', maxResults: 10 });
    assert.ok(Array.isArray(shimGrep.matches));
    assert.ok(shimGrep.matches.some((m) => m.file === "README.md"));

    const formatted = await outputFormat.run({ mode: "Review", evidence: { filesRead: ["README.md"] } });
    assert.equal(formatted.ok, true);
    assert.equal(formatted.mode, "Review");
  } finally {
    if (previousConfig === null) {
      try {
        await fs.unlink(configPath);
      } catch {
        // ignore
      }
    } else {
      await fs.writeFile(configPath, previousConfig, "utf-8");
    }
  }
});
