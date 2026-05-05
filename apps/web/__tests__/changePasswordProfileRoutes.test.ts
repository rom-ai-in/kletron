import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";
import { POST as changePasswordPost } from "../app/api/auth/change-password/route";
import { PATCH as profilePatch } from "../app/api/auth/profile/route";

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f191e810c19729de860ea";

const requireAppRouteAuth = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/auth/apiAuth", () => ({
    requireAppRouteAuth: (...args: unknown[]) => requireAppRouteAuth(...args),
}));

const getDb = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/lib/db", () => ({
    getDb: () => getDb(),
}));

const getProfileByUserId = vi.hoisted(() => vi.fn());
const updateFullName = vi.hoisted(() => vi.fn());
const upsertProfile = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/userProfileService", () => ({
    getProfileByUserId: (...args: unknown[]) => getProfileByUserId(...args),
    updateFullName: (...args: unknown[]) => updateFullName(...args),
    upsertProfile: (...args: unknown[]) => upsertProfile(...args),
}));

const syncPrimaryMemberEmail = vi.hoisted(() => vi.fn());
vi.mock("@kletron/server/services/organizationService", () => ({
    syncPrimaryMemberEmail: (...args: unknown[]) => syncPrimaryMemberEmail(...args),
}));

function mockUsersCollection(userDoc: Record<string, unknown> | null, takenEmailDoc: Record<string, unknown> | null) {
    const findOne = vi.fn().mockImplementation(async (q: Record<string, unknown>) => {
        const idFilter = q._id as Record<string, unknown> | ObjectId | undefined;
        if (
            typeof q.email === "string" &&
            idFilter &&
            typeof idFilter === "object" &&
            !(idFilter instanceof ObjectId) &&
            "$ne" in idFilter
        ) {
            return takenEmailDoc;
        }
        if (q._id) {
            return userDoc;
        }
        return null;
    });
    const updateOne = vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    getDb.mockResolvedValue({
        collection: () => ({ findOne, updateOne }),
    });
    return { findOne, updateOne };
}

describe("POST /api/auth/change-password", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAppRouteAuth.mockResolvedValue(null);
    });

    it("returns 401 when unauthenticated", async () => {
        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({ currentPassword: "a", newPassword: "bbbbbb" }),
        });
        const res = await changePasswordPost(req);
        expect(res.status).toBe(401);
    });

    it("returns 403 when current password is wrong", async () => {
        requireAppRouteAuth.mockResolvedValue({ userId: USER_ID, authType: "session" });
        const hash = await bcrypt.hash("correct", 8);
        mockUsersCollection(
            { _id: new ObjectId(USER_ID), passwordHash: hash },
            null
        );

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({ currentPassword: "wrong", newPassword: "newpass1" }),
        });
        const res = await changePasswordPost(req);
        expect(res.status).toBe(403);
    });

    it("updates password when current password matches", async () => {
        requireAppRouteAuth.mockResolvedValue({ userId: USER_ID, authType: "session" });
        const hash = await bcrypt.hash("oldsecret", 8);
        const { updateOne } = mockUsersCollection({ _id: new ObjectId(USER_ID), passwordHash: hash }, null);

        const req = new Request("http://localhost/api/auth/change-password", {
            method: "POST",
            body: JSON.stringify({ currentPassword: "oldsecret", newPassword: "newpass1" }),
        });
        const res = await changePasswordPost(req);
        expect(res.status).toBe(200);
        expect(updateOne).toHaveBeenCalled();
    });
});

describe("PATCH /api/auth/profile email", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireAppRouteAuth.mockResolvedValue({ userId: USER_ID, authType: "session" });
        getProfileByUserId.mockResolvedValue({ fullName: "Test User", email: "old@example.com" });
        syncPrimaryMemberEmail.mockResolvedValue(true);
    });

    it("returns 400 when email change requested without currentPassword", async () => {
        const req = new Request("http://localhost/api/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({ email: "new@example.com" }),
        });
        const res = await profilePatch(req);
        expect(res.status).toBe(400);
    });

    it("returns 409 when new email is already taken", async () => {
        const hash = await bcrypt.hash("pw", 8);
        mockUsersCollection(
            { _id: new ObjectId(USER_ID), passwordHash: hash },
            { _id: new ObjectId(OTHER_ID), email: "taken@example.com" }
        );

        const req = new Request("http://localhost/api/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({
                email: "taken@example.com",
                currentPassword: "pw",
            }),
        });
        const res = await profilePatch(req);
        expect(res.status).toBe(409);
    });

    it("updates email across users, profile, and tenant when valid", async () => {
        const hash = await bcrypt.hash("pw", 8);
        const { updateOne } = mockUsersCollection(
            { _id: new ObjectId(USER_ID), passwordHash: hash },
            null
        );

        const req = new Request("http://localhost/api/auth/profile", {
            method: "PATCH",
            body: JSON.stringify({
                email: "fresh@example.com",
                currentPassword: "pw",
            }),
        });
        const res = await profilePatch(req);
        expect(res.status).toBe(200);
        expect(updateOne).toHaveBeenCalled();
        expect(upsertProfile).toHaveBeenCalledWith(USER_ID, "fresh@example.com", "Test User");
        expect(syncPrimaryMemberEmail).toHaveBeenCalledWith(USER_ID, "fresh@example.com");
    });
});
