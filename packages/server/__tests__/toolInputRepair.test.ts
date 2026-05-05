import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseToolInputWithRepair, repairToolInputValue } from "../src/services/toolInputRepair";

describe("toolInputRepair", () => {
    it("parses a full JSON-string payload before repairing nested values", () => {
        const schema = z.object({
            query: z.string().min(1),
            maxResults: z.number().int().positive().optional(),
            showHidden: z.boolean().optional(),
        });

        const parsed = parseToolInputWithRepair(
            schema,
            '{"query":"meeting tomorrow","maxResults":"10","showHidden":"False"}',
            "calendar_list_events"
        );

        expect(parsed).toEqual({
            query: "meeting tomorrow",
            maxResults: 10,
            showHidden: false,
        });
    });

    it("coerces booleans, numbers, enums, and singleton arrays", () => {
        const schema = z.object({
            includeSpamTrash: z.boolean().optional(),
            maxResults: z.number().int().positive(),
            sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
            attendees: z.array(z.string()).optional(),
        });

        const parsed = parseToolInputWithRepair(schema, {
            includeSpamTrash: "True",
            maxResults: "10",
            sendUpdates: "EXTERNALONLY",
            attendees: "alice@example.com",
        }, "calendar_create_event");

        expect(parsed).toEqual({
            includeSpamTrash: true,
            maxResults: 10,
            sendUpdates: "externalOnly",
            attendees: ["alice@example.com"],
        });
    });

    it("unwraps nested argument payloads and maps common file/tool aliases", () => {
        const schema = z.object({
            filePath: z.string().min(1),
            content: z.string().min(1),
            repoPath: z.string().optional(),
        });

        const parsed = parseToolInputWithRepair(
            schema,
            {
                repo_path: "/tmp/repo",
                arguments: {
                    path: "notes/output.md",
                    text: "hello",
                },
            },
            "write_file"
        );

        expect(parsed).toEqual({
            repoPath: "/tmp/repo",
            filePath: "notes/output.md",
            content: "hello",
        });
    });

    it("maps execute_bash aliases like cmd and workdir", () => {
        const schema = z.object({
            command: z.string().min(1),
            path: z.string().optional(),
            timeoutMs: z.number().int().positive().optional(),
        });

        const parsed = parseToolInputWithRepair(
            schema,
            {
                cmd: "pwd",
                workdir: "/tmp/repo",
                timeoutMs: "5000",
            },
            "execute_bash"
        );

        expect(parsed).toEqual({
            command: "pwd",
            path: "/tmp/repo",
            timeoutMs: 5000,
        });
    });

    it("maps glob_files path/query aliases into pattern and cwd", () => {
        const schema = z.object({
            pattern: z.string().min(1),
            cwd: z.string().optional(),
        });

        expect(
            parseToolInputWithRepair(
                schema,
                { path: "src/**/*.ts" },
                "glob_files"
            )
        ).toEqual({
            pattern: "src/**/*.ts",
        });

        expect(
            parseToolInputWithRepair(
                schema,
                { directory: "src", query: "**/*.ts" },
                "glob_files"
            )
        ).toEqual({
            pattern: "**/*.ts",
            cwd: "src",
        });
    });

    it("maps range aliases for read_file_range", () => {
        const schema = z.object({
            filePath: z.string().min(1),
            startLine: z.number().int().positive(),
            endLine: z.number().int().positive(),
        });

        const parsed = parseToolInputWithRepair(
            schema,
            { path: "README.md", start: "5", end: "12" },
            "read_file_range"
        );

        expect(parsed).toEqual({
            filePath: "README.md",
            startLine: 5,
            endLine: 12,
        });
    });

    it("repairs nested objects and booleans inside arrays", () => {
        const schema = z.object({
            reminders: z.object({
                useDefault: z.boolean().optional(),
                overrides: z.array(z.object({
                    method: z.enum(["email", "popup"]),
                    minutes: z.number().int().nonnegative(),
                })).optional(),
            }).optional(),
        });

        const repaired = repairToolInputValue(schema, {
            reminders: {
                useDefault: "false",
                overrides: {
                    method: "EMAIL",
                    minutes: "15",
                },
            },
        });

        expect(schema.parse(repaired)).toEqual({
            reminders: {
                useDefault: false,
                overrides: [{ method: "email", minutes: 15 }],
            },
        });
    });

    it("surfaces a clear validation error when repair still cannot satisfy the schema", () => {
        const schema = z.object({
            eventId: z.string().min(1),
        });

        expect(() => parseToolInputWithRepair(schema, {}, "calendar_get_event")).toThrow(
            /Tool input validation failed for calendar_get_event/
        );
    });
});
