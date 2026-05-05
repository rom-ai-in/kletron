import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const integrationsCollection = {
    createIndex: vi.fn().mockResolvedValue("ok"),
    updateMany: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId("507f1f77bcf86cd799439011") }),
    findOne: vi.fn(),
    find: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
};

const mcpCollection = {
    createIndex: vi.fn().mockResolvedValue("ok"),
    updateMany: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
    insertOne: vi.fn().mockResolvedValue({ insertedId: new ObjectId("507f1f77bcf86cd799439012") }),
    findOne: vi.fn(),
    find: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    toArray: vi.fn().mockResolvedValue([]),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1 }),
};

const mockDb = {
    collection: vi.fn((name: string) => {
        if (name === "account_integrations") return integrationsCollection;
        if (name === "account_mcp_servers") return mcpCollection;
        throw new Error(`Unexpected collection: ${name}`);
    }),
};

vi.mock("../src/lib/db", () => ({
    getDatabase: vi.fn().mockResolvedValue(mockDb),
}));

vi.mock("../src/lib/crypto/secrets", () => ({
    encryptJson: vi.fn((value: unknown) => ({
        v: 1,
        iv: "iv",
        tag: "tag",
        ct: Buffer.from(JSON.stringify(value ?? null), "utf8").toString("base64"),
    })),
    decryptJson: vi.fn(),
    maskSecret: vi.fn((value: string) => `${value.slice(0, 2)}***${value.slice(-2)}`),
}));

describe("accountConnectorsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("revokes previous active integrations when a new Google integration is created", async () => {
        const { createAccountIntegration } = await import(
            "../src/services/accountConnectorsService"
        );

        await createAccountIntegration("owner-1", {
            providerId: "gmail",
            credentials: {
                refreshToken: "refresh-token",
                accessToken: "access-token",
            },
            scopes: [
                "https://www.googleapis.com/auth/gmail.modify",
                "https://www.googleapis.com/auth/gmail.metadata",
            ],
        });

        expect(integrationsCollection.updateMany).toHaveBeenCalledWith(
            { ownerId: "owner-1", providerId: "gmail", status: "active" },
            { $set: { status: "revoked", updatedAt: expect.any(Date) } }
        );
        expect(integrationsCollection.insertOne).toHaveBeenCalledOnce();
    });

    it("queries the newest active integration first", async () => {
        integrationsCollection.findOne.mockResolvedValueOnce({
            _id: new ObjectId("507f1f77bcf86cd799439099"),
            ownerId: "owner-1",
            providerId: "gmail",
            displayName: "Newest Gmail",
            credentials: {
                v: 1,
                iv: "iv",
                tag: "tag",
                ct: "ct",
            },
            credentialPreview: {},
            scopes: ["https://www.googleapis.com/auth/gmail.modify"],
            status: "active",
            lastUsedAt: null,
            createdAt: new Date("2026-05-05T12:00:00.000Z"),
            updatedAt: new Date("2026-05-05T13:00:00.000Z"),
        });

        const { findActiveAccountIntegration } = await import(
            "../src/services/accountConnectorsService"
        );

        await findActiveAccountIntegration("owner-1", "gmail");

        expect(integrationsCollection.findOne).toHaveBeenCalledWith(
            { ownerId: "owner-1", providerId: "gmail", status: "active" },
            { sort: { updatedAt: -1, createdAt: -1, _id: -1 } }
        );
    });
});
