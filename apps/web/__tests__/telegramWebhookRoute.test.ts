import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@kletron/server/services/channelStoreService", () => ({
    ensureChannelStoreIndexes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@kletron/server/services/channelCredentialsService", () => ({
    resolveTelegramBotCredentials: vi.fn(),
}));

vi.mock("@kletron/server/services/channelInboundJobService", () => ({
    enqueueTelegramInboundJob: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "../app/api/webhooks/channels/telegram/route";
import { resolveTelegramBotCredentials } from "@kletron/server/services/channelCredentialsService";
import { enqueueTelegramInboundJob } from "@kletron/server/services/channelInboundJobService";

describe("POST /api/webhooks/channels/telegram", () => {
    beforeEach(() => {
        vi.mocked(resolveTelegramBotCredentials).mockReset();
        vi.mocked(enqueueTelegramInboundJob).mockClear();
    });

    it("returns 503 when the bot token is not configured", async () => {
        vi.mocked(resolveTelegramBotCredentials).mockResolvedValue(null);
        const req = new NextRequest("http://localhost/api/webhooks/channels/telegram", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ update_id: 1 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(503);
        expect(enqueueTelegramInboundJob).not.toHaveBeenCalled();
    });

    it("returns 401 when the webhook secret does not match", async () => {
        vi.mocked(resolveTelegramBotCredentials).mockResolvedValue({
            botToken: "t",
            webhookSecret: "expected",
        });
        const req = new NextRequest("http://localhost/api/webhooks/channels/telegram", {
            method: "POST",
            headers: { "content-type": "application/json", "x-telegram-bot-api-secret-token": "wrong" },
            body: JSON.stringify({ update_id: 1 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
        expect(enqueueTelegramInboundJob).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid JSON body", async () => {
        vi.mocked(resolveTelegramBotCredentials).mockResolvedValue({ botToken: "t" });
        const req = new NextRequest("http://localhost/api/webhooks/channels/telegram", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: "not-json",
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
        expect(enqueueTelegramInboundJob).not.toHaveBeenCalled();
    });

    it("enqueues the update when credentials are valid", async () => {
        vi.mocked(resolveTelegramBotCredentials).mockResolvedValue({ botToken: "tok", webhookSecret: "sec" });
        const payload = {
            update_id: 99,
            message: {
                message_id: 1,
                from: { id: 1 },
                chat: { id: 2, type: "private" },
                text: "hi",
            },
        };
        const req = new NextRequest("http://localhost/api/webhooks/channels/telegram", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "x-telegram-bot-api-secret-token": "sec",
            },
            body: JSON.stringify(payload),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        expect(enqueueTelegramInboundJob).toHaveBeenCalledTimes(1);
        expect(vi.mocked(enqueueTelegramInboundJob).mock.calls[0][0]).toEqual(payload);
    });
});
