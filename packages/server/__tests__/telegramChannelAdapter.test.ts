import { describe, expect, it } from "vitest";
import { telegramUpdateToNormalized } from "../src/services/telegramChannelAdapter";

describe("telegramUpdateToNormalized", () => {
    it("maps plain text messages", () => {
        const ev = telegramUpdateToNormalized({
            update_id: 1,
            message: {
                message_id: 10,
                from: { id: 42 },
                chat: { id: 99, type: "private" },
                text: "  hello  ",
            },
        });
        expect(ev?.text).toBe("hello");
        expect(ev?.externalUserId).toBe("42");
        expect(ev?.externalChatKey).toBe("telegram:chat:99");
        expect(ev?.inboundMessageId).toBe("tg:1:10");
        expect(ev?.attachments).toBeUndefined();
    });

    it("uses caption when there is no text", () => {
        const ev = telegramUpdateToNormalized({
            update_id: 2,
            message: {
                message_id: 11,
                from: { id: 1 },
                chat: { id: 2, type: "private" },
                caption: "see photo",
                photo: [{ file_id: "abc", width: 10, height: 10 }],
            },
        });
        expect(ev?.text).toBe("see photo");
        expect(ev?.attachments?.length).toBe(1);
        expect(ev?.attachments?.[0].kind).toBe("image");
        expect(ev?.attachments?.[0].name).toContain("tg_file_id:abc");
    });

    it("synthesizes text for attachment-only messages", () => {
        const ev = telegramUpdateToNormalized({
            update_id: 3,
            message: {
                message_id: 12,
                chat: { id: 5, type: "private" },
                photo: [
                    { file_id: "small", width: 1, height: 1 },
                    { file_id: "big", width: 100, height: 100 },
                ],
            },
        });
        expect(ev?.text).toMatch(/\[image\]/);
        expect(ev?.attachments?.[0].name).toContain("big");
    });

    it("includes voice and document attachments", () => {
        const ev = telegramUpdateToNormalized({
            update_id: 4,
            message: {
                message_id: 13,
                from: { id: 7 },
                chat: { id: 8, type: "private" },
                document: { file_id: "doc1", file_name: "a.pdf" },
                voice: { file_id: "v1" },
            },
        });
        expect(ev?.attachments?.some((a) => a.kind === "file")).toBe(true);
        expect(ev?.attachments?.some((a) => a.kind === "other")).toBe(true);
        expect(ev?.text).toMatch(/\[file\].*\[other\]/);
    });

    it("returns null when there is nothing to process", () => {
        expect(
            telegramUpdateToNormalized({
                update_id: 5,
                message: {
                    message_id: 14,
                    chat: { id: 1, type: "private" },
                },
            })
        ).toBeNull();
    });
});
