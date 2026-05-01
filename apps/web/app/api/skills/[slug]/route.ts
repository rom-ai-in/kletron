// Per-skill operations.
// GET    /api/skills/:slug
// PUT    /api/skills/:slug    (user skills only)
// DELETE /api/skills/:slug    (user skills only)

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    deleteSkill,
    getSkillBySlug,
    updateSkill,
} from "@kletron/server/services/skillsService";
import { skillUpdateSchema } from "@kletron/shared/skills/types";

export const dynamic = "force-dynamic";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    const { slug } = await params;
    const skill = await getSkillBySlug(slug);
    if (!skill) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (skill.source === "user") {
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (auth.authType !== "internal" && skill.ownerId !== auth.userId) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
    }
    return NextResponse.json({ skill });
}

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { slug } = await params;
        const body = await request.json();
        const validated = skillUpdateSchema.parse(body);
        const updated = await updateSkill(slug, validated, auth.userId);
        if (!updated) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ skill: updated });
    } catch (error) {
        if (error instanceof ZodError) {
            return NextResponse.json(
                { error: "Validation failed", issues: error.issues },
                { status: 400 }
            );
        }
        const message = (error as Error).message;
        const status = /permission|cannot/i.test(message) ? 403 : 500;
        console.error("[/api/skills/:slug PUT]", error);
        return NextResponse.json({ error: message }, { status });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        const { slug } = await params;
        const ok = await deleteSkill(slug, auth.userId);
        if (!ok) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        const message = (error as Error).message;
        const status = /permission|cannot/i.test(message) ? 403 : 500;
        console.error("[/api/skills/:slug DELETE]", error);
        return NextResponse.json({ error: message }, { status });
    }
}
