// POST /api/auth/change-password — logged-in user; requires current password
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@kletron/server/lib/db";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (!ObjectId.isValid(auth.userId)) {
        return NextResponse.json(
            { success: false, error: "Password change is not available for this account type" },
            { status: 400 }
        );
    }

    try {
        const body = await request.json().catch(() => ({}));
        const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
        const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, error: "Current password and new password are required" },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { success: false, error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        const db = await getDb();
        const user = await db.collection("users").findOne<{ _id: ObjectId; passwordHash?: string; password?: string }>(
            { _id: new ObjectId(auth.userId) }
        );

        if (!user) {
            return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
        }

        const storedHash =
            typeof user.passwordHash === "string"
                ? user.passwordHash
                : typeof user.password === "string"
                  ? user.password
                  : null;
        if (!storedHash) {
            return NextResponse.json({ success: false, error: "Password login not configured" }, { status: 400 });
        }

        const bcrypt = (await import("bcrypt")).default;
        const ok = await bcrypt.compare(currentPassword, storedHash);
        if (!ok) {
            return NextResponse.json({ success: false, error: "Current password is incorrect" }, { status: 403 });
        }

        const passwordHash = await bcrypt.hash(newPassword, 12);
        await db.collection("users").updateOne(
            { _id: user._id },
            { $set: { passwordHash, password: passwordHash, updatedAt: new Date() } }
        );

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("[change-password]", err);
        return NextResponse.json({ success: false, error: "An unexpected error occurred" }, { status: 500 });
    }
}
