// app/api/auth/profile/route.ts
// PATCH — update fullName, and/or email (email requires currentPassword)
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { getDb } from "@kletron/server/lib/db";
import * as userProfileService from "@kletron/server/services/userProfileService";
import * as organizationService from "@kletron/server/services/organizationService";

const EMAIL_CHANGE_REQUIRES_DB_USER =
    "Email can only be changed for a registered account. Sign out and sign in with the email you used at registration (not the built-in demo login).";

async function verifyUserPassword(
    userId: string,
    plainPassword: string
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    if (!ObjectId.isValid(userId)) {
        return { ok: false, status: 400, message: EMAIL_CHANGE_REQUIRES_DB_USER };
    }
    const db = await getDb();
    const user = await db.collection("users").findOne<{ passwordHash?: string; password?: string }>({
        _id: new ObjectId(userId),
    });
    if (!user) {
        return { ok: false, status: 404, message: "User not found" };
    }
    const storedHash =
        typeof user.passwordHash === "string"
            ? user.passwordHash
            : typeof user.password === "string"
              ? user.password
              : null;
    if (!storedHash) {
        return { ok: false, status: 400, message: "Password login not configured" };
    }
    const bcrypt = (await import("bcrypt")).default;
    const match = await bcrypt.compare(plainPassword, storedHash);
    if (!match) {
        return { ok: false, status: 403, message: "Current password is incorrect" };
    }
    return { ok: true };
}

export async function PATCH(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
        });
    }

    try {
        const body = await request.json().catch(() => ({}));

        const hasFullName = "fullName" in body;
        const fullName = hasFullName && typeof body.fullName === "string" ? body.fullName.trim() : undefined;

        const emailInput = typeof body.email === "string" ? body.email.trim() : "";
        const wantsEmailChange = emailInput.length > 0;
        const newEmail = wantsEmailChange ? emailInput.toLowerCase() : null;

        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";

        if (wantsEmailChange && !currentPassword) {
            return NextResponse.json(
                { success: false, message: "currentPassword is required to change email" },
                { status: 400 }
            );
        }

        if (wantsEmailChange) {
            const v = await verifyUserPassword(auth.userId, currentPassword);
            if (!v.ok) {
                return NextResponse.json({ success: false, message: v.message }, { status: v.status });
            }

            const db = await getDb();
            const taken = await db.collection("users").findOne({
                email: newEmail,
                _id: { $ne: new ObjectId(auth.userId) },
            });
            if (taken) {
                return NextResponse.json({ success: false, message: "Email is already in use" }, { status: 409 });
            }

            const existingProfile = await userProfileService.getProfileByUserId(auth.userId);
            const nameForProfile =
                hasFullName && fullName !== undefined ? fullName || null : existingProfile?.fullName ?? null;

            const userSet: Record<string, unknown> = { email: newEmail, updatedAt: new Date() };
            if (hasFullName && fullName !== undefined) {
                userSet.name = fullName || null;
            }

            await db.collection("users").updateOne({ _id: new ObjectId(auth.userId) }, { $set: userSet });

            await userProfileService.upsertProfile(auth.userId, newEmail!, nameForProfile);
            await organizationService.syncPrimaryMemberEmail(auth.userId, newEmail!);
        } else if (hasFullName && fullName !== undefined) {
            await userProfileService.updateFullName(auth.userId, fullName);
            if (ObjectId.isValid(auth.userId)) {
                const db = await getDb();
                await db.collection("users").updateOne(
                    { _id: new ObjectId(auth.userId) },
                    { $set: { name: fullName || null, updatedAt: new Date() } }
                );
            }
        }

        const profile = await userProfileService.getProfileByUserId(auth.userId);

        return NextResponse.json({
            success: true,
            profile: profile
                ? {
                      id: profile.id,
                      fullName: profile.fullName,
                      email: profile.email,
                      createdAt: profile.createdAt,
                      updatedAt: profile.updatedAt,
                  }
                : null,
        });
    } catch (err) {
        console.error("Profile update error:", err);
        return NextResponse.json({ success: false, message: "Failed to update profile" }, { status: 500 });
    }
}
