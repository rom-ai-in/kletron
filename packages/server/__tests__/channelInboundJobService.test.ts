import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";

const insertOneMock = vi.hoisted(() => vi.fn().mockResolvedValue({ acknowledged: true }));
const findOneAndUpdateMock = vi.hoisted(() => vi.fn());
const deleteOneMock = vi.hoisted(() => vi.fn().mockResolvedValue({ acknowledged: true }));
const updateOneMock = vi.hoisted(() => vi.fn().mockResolvedValue({ acknowledged: true }));
const executeInboundMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("../src/lib/db", () => ({
    getDb: vi.fn(async () => ({
        collection: () => ({
            insertOne: insertOneMock,
            findOneAndUpdate: findOneAndUpdateMock,
            deleteOne: deleteOneMock,
            updateOne: updateOneMock,
            createIndex: vi.fn().mockResolvedValue({}),
        }),
    })),
}));

vi.mock("../src/services/telegramInboundProcessor", () => ({
    executeTelegramInboundUpdate: executeInboundMock,
}));

import { enqueueTelegramInboundJob } from "../src/services/channelInboundJobService";

describe("channelInboundJobService", () => {
    beforeEach(() => {
        delete process.env.CHANNEL_TELEGRAM_QUEUE_BACKEND;
        insertOneMock.mockClear();
        deleteOneMock.mockClear();
        updateOneMock.mockClear();
        findOneAndUpdateMock.mockReset();
        executeInboundMock.mockReset();
        executeInboundMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        delete process.env.CHANNEL_TELEGRAM_QUEUE_BACKEND;
    });

    it("CHANNEL_TELEGRAM_QUEUE_BACKEND=memory runs the processor without Mongo writes", async () => {
        process.env.CHANNEL_TELEGRAM_QUEUE_BACKEND = "memory";
        const payload = { update_id: 42 } as Parameters<typeof enqueueTelegramInboundJob>[0];
        await enqueueTelegramInboundJob(payload);
        await vi.waitFor(() => {
            expect(executeInboundMock).toHaveBeenCalledTimes(1);
        });
        expect(executeInboundMock).toHaveBeenCalledWith(payload);
        expect(insertOneMock).not.toHaveBeenCalled();
    });

    it("default backend inserts a pending job and drain claims + executes + deletes", async () => {
        const payload = { update_id: 99, message: { message_id: 1, chat: { id: 1, type: "private" }, text: "x" } } as Parameters<
            typeof enqueueTelegramInboundJob
        >[0];
        const jobId = new ObjectId();

        findOneAndUpdateMock
            .mockResolvedValueOnce({
                _id: jobId,
                channel: "telegram" as const,
                payload,
                status: "processing" as const,
                createdAt: new Date(),
            })
            .mockResolvedValueOnce(null);

        await enqueueTelegramInboundJob(payload);

        expect(insertOneMock).toHaveBeenCalledWith(
            expect.objectContaining({
                channel: "telegram",
                status: "pending",
                payload,
            })
        );
        await vi.waitFor(() => expect(executeInboundMock).toHaveBeenCalledWith(payload));
        expect(findOneAndUpdateMock).toHaveBeenCalled();
        expect(deleteOneMock).toHaveBeenCalledWith({ _id: jobId });
        expect(updateOneMock).not.toHaveBeenCalled();
    });

    it("marks job failed when execution throws", async () => {
        const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            const payload = { update_id: 100 } as Parameters<typeof enqueueTelegramInboundJob>[0];
            const jobId = new ObjectId();
            executeInboundMock.mockRejectedValueOnce(new Error("boom"));

            findOneAndUpdateMock
                .mockResolvedValueOnce({
                    _id: jobId,
                    channel: "telegram" as const,
                    payload,
                    status: "processing" as const,
                    createdAt: new Date(),
                })
                .mockResolvedValueOnce(null);

            await enqueueTelegramInboundJob(payload);

            await vi.waitFor(() =>
                expect(updateOneMock).toHaveBeenCalledWith(
                    { _id: jobId },
                    expect.objectContaining({
                        $set: expect.objectContaining({
                            status: "failed",
                            lastError: expect.stringContaining("boom"),
                        }),
                    })
                )
            );
            expect(deleteOneMock).not.toHaveBeenCalled();
        } finally {
            errSpy.mockRestore();
        }
    });
});
