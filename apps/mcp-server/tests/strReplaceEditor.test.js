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

async function writeTestFile(root, rel, content) {
  const full = path.join(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf-8");
}

async function readTestFile(root, rel) {
  return fs.readFile(path.join(root, rel), "utf-8");
}

async function makeTempRepo() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "str-replace-test-"));
  await execFileAsync("git", ["init"], { cwd: root });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: root });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: root });
  return root;
}

let previousConfig = null;

test("str_replace_editor: full Anthropic-style command suite", async (t) => {
  const repoRoot = await makeTempRepo();

  try {
    previousConfig = await fs.readFile(configPath, "utf-8");
  } catch {
    previousConfig = null;
  }

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(
    configPath,
    JSON.stringify({ workingFolder: repoRoot, workspaceRoots: [repoRoot] }, null, 2),
    "utf-8"
  );

  // Dynamically import to get fresh instance
  const { strReplaceEditor } = await import("../tools/strReplaceEditor.js");

  try {
    // ── Setup: create test files ──
    await writeTestFile(repoRoot, "hello.txt", "line 1\nline 2\nline 3\nline 4\nline 5\n");
    await writeTestFile(repoRoot, "unique.txt", "foo\nbar\nbaz\n");
    await writeTestFile(repoRoot, "duplicate.txt", "hello\nworld\nhello\n");
    await execFileAsync("git", ["add", "."], { cwd: repoRoot });
    await execFileAsync("git", ["commit", "-m", "init"], { cwd: repoRoot });

    // ── 1. VIEW: read entire file ──
    await t.test("view: read entire file", async () => {
      const result = await strReplaceEditor.run({ repoPath: repoRoot, path: "hello.txt", command: "view" });
      assert.equal(result.file, "hello.txt");
      assert.ok(result.text.includes("line 1"));
      assert.ok(result.text.includes("line 5"));
      assert.equal(result.truncated, false);
    });

    // ── 2. VIEW: read with line range ──
    await t.test("view: read with line range", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "hello.txt", command: "view",
        startLine: 2, endLine: 3,
      });
      assert.ok(result.text.includes("line 2"));
      assert.ok(result.text.includes("line 3"));
    });

    // ── 3. VIEW: read with view_range array ──
    await t.test("view: read with view_range array", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "hello.txt", command: "view",
        view_range: [1, 2],
      });
      assert.ok(result.text.includes("line 1"));
      assert.ok(result.text.includes("line 2"));
    });

    // ── 4. VIEW: backward compat (action alias) ──
    await t.test("view: backward compat with action param", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "hello.txt", action: "view",
      });
      assert.ok(result.text.includes("line 1"));
    });

    // ── 5. CREATE: create a new file ──
    await t.test("create: create a new file", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "new_file.txt", command: "create",
        file_text: "Hello World\nSecond line\n",
      });
      assert.equal(result.ok, true);
      assert.equal(result.file, "new_file.txt");

      const content = await readTestFile(repoRoot, "new_file.txt");
      assert.equal(content, "Hello World\nSecond line\n");
    });

    // ── 6. CREATE: fail if file exists ──
    await t.test("create: fail if file exists", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "hello.txt", command: "create",
        file_text: "Should not overwrite",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("already exists"));
    });

    // ── 7. CREATE: create in subdirectory ──
    await t.test("create: create in nested directory", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "sub/dir/deep.txt", command: "create",
        file_text: "deep file content",
      });
      assert.equal(result.ok, true);
      const content = await readTestFile(repoRoot, "sub/dir/deep.txt");
      assert.equal(content, "deep file content");
    });

    // ── 8. STR_REPLACE: successful replacement ──
    await t.test("str_replace: successful replacement", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "unique.txt", command: "str_replace",
        old_str: "bar", new_str: "BAR_REPLACED",
      });
      assert.equal(result.ok, true);
      const content = await readTestFile(repoRoot, "unique.txt");
      assert.ok(content.includes("BAR_REPLACED"));
      assert.ok(!content.includes("\nbar\n"));
    });

    // ── 9. STR_REPLACE: fail on no match ──
    await t.test("str_replace: fail on no match", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "unique.txt", command: "str_replace",
        old_str: "nonexistent_text", new_str: "replacement",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("No match found"));
    });

    // ── 10. STR_REPLACE: fail on multiple matches ──
    await t.test("str_replace: fail on multiple matches", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "duplicate.txt", command: "str_replace",
        old_str: "hello", new_str: "REPLACED",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("2 occurrences"));
    });

    // ── 11. STR_REPLACE: multi-line replacement ──
    await t.test("str_replace: multi-line replacement", async () => {
      await writeTestFile(repoRoot, "multiline.txt", "function foo() {\n  return 1;\n}\n");
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "multiline.txt", command: "str_replace",
        old_str: "function foo() {\n  return 1;\n}",
        new_str: "function foo() {\n  return 42;\n}",
      });
      assert.equal(result.ok, true);
      const content = await readTestFile(repoRoot, "multiline.txt");
      assert.ok(content.includes("return 42;"));
    });

    // ── 12. INSERT: insert after specific line ──
    await t.test("insert: insert after specific line", async () => {
      await writeTestFile(repoRoot, "insert_test.txt", "line A\nline B\nline C\n");
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "insert_test.txt", command: "insert",
        insert_line: 2, new_str: "INSERTED LINE",
      });
      assert.equal(result.ok, true);
      const content = await readTestFile(repoRoot, "insert_test.txt");
      const lines = content.split("\n");
      assert.equal(lines[2], "INSERTED LINE");
    });

    // ── 13. INSERT: insert at beginning (line 0) ──
    await t.test("insert: insert at beginning (line 0)", async () => {
      await writeTestFile(repoRoot, "insert_begin.txt", "first\nsecond\n");
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "insert_begin.txt", command: "insert",
        insert_line: 0, new_str: "HEADER",
      });
      assert.equal(result.ok, true);
      const content = await readTestFile(repoRoot, "insert_begin.txt");
      assert.ok(content.startsWith("HEADER\n"));
    });

    // ── 14. INSERT: fail on out-of-range line ──
    await t.test("insert: fail on out-of-range line", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "insert_begin.txt", command: "insert",
        insert_line: 9999, new_str: "OUT_OF_RANGE",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("out of range"));
    });

    // ── 15. UNDO_EDIT: undo last str_replace ──
    await t.test("undo_edit: undo last edit", async () => {
      await writeTestFile(repoRoot, "undo_test.txt", "original content\n");
      // Perform a str_replace
      await strReplaceEditor.run({
        repoPath: repoRoot, path: "undo_test.txt", command: "str_replace",
        old_str: "original content", new_str: "modified content",
      });
      const modified = await readTestFile(repoRoot, "undo_test.txt");
      assert.ok(modified.includes("modified content"));

      // Undo
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "undo_test.txt", command: "undo_edit",
      });
      assert.equal(result.ok, true);
      const restored = await readTestFile(repoRoot, "undo_test.txt");
      assert.ok(restored.includes("original content"));
    });

    // ── 16. UNDO_EDIT: fail when no undo history ──
    await t.test("undo_edit: fail when no undo history", async () => {
      await writeTestFile(repoRoot, "no_undo.txt", "nothing to undo\n");
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "no_undo.txt", command: "undo_edit",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("No undo history"));
    });

    // ── 17. SECURITY: blocked extension ──
    await t.test("security: block .env files for write", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "secrets.env", command: "create",
        file_text: "SECRET=should_not_write",
      });
      // Should throw or return error
      assert.ok(result.ok === false || result.error);
    });

    // ── 18. SECURITY: blocked dotfile ──
    await t.test("security: block dotfile writes", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: ".secret_config", command: "create",
        file_text: "should not write",
      });
      assert.ok(result.ok === false || result.error);
    });

    // ── 19. ERROR: unknown command ──
    await t.test("error: unknown command", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "hello.txt", command: "destroy",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("Unknown command"));
    });

    // ── 20. STR_REPLACE: empty old_str ──
    await t.test("str_replace: reject empty old_str", async () => {
      const result = await strReplaceEditor.run({
        repoPath: repoRoot, path: "hello.txt", command: "str_replace",
        old_str: "", new_str: "something",
      });
      assert.equal(result.ok, false);
      assert.ok(result.error.includes("cannot be empty"));
    });

  } finally {
    // Restore config
    if (previousConfig === null) {
      try { await fs.unlink(configPath); } catch {}
    } else {
      await fs.writeFile(configPath, previousConfig, "utf-8");
    }
    // Cleanup temp repo
    try { await fs.rm(repoRoot, { recursive: true, force: true }); } catch {}
  }
});
