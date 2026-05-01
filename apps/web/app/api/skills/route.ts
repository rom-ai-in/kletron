// Global Skills Library
//
// GET  /api/skills            -> list skills (built-in + the caller's user skills)
// POST /api/skills            -> create a new user skill (SKILL.md)
//
// Auth: requireAppRouteAuth. Anonymous + dev-bypass requests get only built-ins.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    createSkill,
    listSkills,
} from "@kletron/server/services/skillsService";
import { skillCreateSchema } from "@kletron/shared/skills/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const auth = await requireAppRouteAuth(request);
    const url = new URL(request.url);
    try {
        const viewerUserId =
            auth?.authType === "internal"
                ? null
                : auth?.userId;

        const records = await listSkills({
            tag: url.searchParams.get("tag") ?? undefined,
            search: url.searchParams.get("search") ?? undefined,
            source:
                (url.searchParams.get("source") as "builtin" | "user" | null) ??
                undefined,
            viewerUserId,
            limit: Number(url.searchParams.get("limit") ?? 200),
        });
        return NextResponse.json({ skills: records });
    } catch (error) {
        console.error("[/api/skills GET]", error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const body = await request.json();
        const validated = skillCreateSchema.parse(body);
        const skill = await createSkill(validated, auth.userId);
        return NextResponse.json({ skill }, { status: 201 });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", issues: error.issues },
                { status: 400 }
            );
        }
        const message = (error as Error).message;
        const status = /already exists/i.test(message) ? 409 : 500;
        console.error("[/api/skills POST]", error);
        return NextResponse.json({ error: message }, { status });
    }
}
