import { describe, expect, it } from "vitest";

import { allMcpTools } from "@kletron/agent-core/tools/mcpTools";

describe("google workspace tool bundle", () => {
    it("registers Gmail, Calendar, and Drive tools in allMcpTools", () => {
        const names = new Set(allMcpTools.map((tool: { name?: string }) => String(tool?.name ?? "")));

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
            expect(names.has(toolName), `Missing Google tool registration for ${toolName}`).toBe(true);
        }
    });
});
