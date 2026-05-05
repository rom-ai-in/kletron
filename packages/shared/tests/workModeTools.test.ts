import { describe, it, expect } from "vitest";
import { WORK_MODE_TOOL_ALLOWLIST, WORK_MODES } from "../src/workMode";
import { STANDARD_WORKSPACE_BUNDLED_TOOLS } from "../src/agentBundledTools";

describe("Work mode tool surface (Cowork-style)", () => {
    it("excludes terminal and git CLI tools", () => {
        expect(WORK_MODE_TOOL_ALLOWLIST).not.toContain("execute_bash");
        expect(WORK_MODE_TOOL_ALLOWLIST).not.toContain("git_log");
        expect(WORK_MODE_TOOL_ALLOWLIST).not.toContain("git_diff");
        expect(WORK_MODE_TOOL_ALLOWLIST).not.toContain("git_grep");
        expect(WORK_MODE_TOOL_ALLOWLIST).not.toContain("git_blame");
    });

    it("includes file writes and research connectors", () => {
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("write_file");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("str_replace_editor");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("web_search");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("fetch_url");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("list_available_skills");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("load_skill");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("write_todos");
    });

    it("includes SaaS connector REST tools (GitHub, Sentry) for work mode", () => {
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("github_api");
        expect(WORK_MODE_TOOL_ALLOWLIST).toContain("sentry_api");
    });

    it("includes Google workspace tools for Cowork-style work mode", () => {
        for (const toolName of [
            "gmail_list_labels",
            "gmail_search_messages",
            "gmail_read_message",
            "gmail_modify_message_labels",
            "gmail_create_draft",
            "gmail_send_message",
            "calendar_list_calendars",
            "calendar_freebusy",
            "calendar_list_events",
            "calendar_get_event",
            "calendar_create_event",
            "calendar_update_event",
            "calendar_delete_event",
            "drive_list_files",
            "drive_read_file",
            "drive_write_text_file",
        ]) {
            expect(WORK_MODE_TOOL_ALLOWLIST).toContain(toolName);
        }
    });

    it("includes every standard bundled tool except stripped git/bash", () => {
        const stripped = new Set(["execute_bash", "git_log", "git_diff", "git_grep", "git_blame"]);
        for (const t of STANDARD_WORKSPACE_BUNDLED_TOOLS) {
            if (stripped.has(t)) {
                expect(WORK_MODE_TOOL_ALLOWLIST).not.toContain(t);
            } else {
                expect(WORK_MODE_TOOL_ALLOWLIST).toContain(t);
            }
        }
    });

    it("matches WORK_MODES.work.availableTools", () => {
        expect(WORK_MODES.work.availableTools).toEqual(WORK_MODE_TOOL_ALLOWLIST);
    });
});
