import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseToolInputWithRepair, repairToolInputValue } from "../src/services/toolInputRepair";

describe("toolInputRepair", () => {
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
