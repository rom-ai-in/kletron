// Per-skill operations.
// GET    /api/skills/:slug
// PUT    /api/skills/:slug    (user skills only)
// DELETE /api/skills/:slug    (user skills only)

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSkill as getResolvedSkillFromRegistry } from "@kletron/agent-core/skills/registry";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    deleteSkill,
    getSkillBySlug,
    updateSkill,
} from "@kletron/server/services/skillsService";
import { getWorkspaceById } from "@kletron/server/services/workspaceService";
import { skillUpdateSchema } from "@kletron/shared/skills/types";

export const dynamic = "force-dynamic";

function skillFromRegistry(slug: string, resolved: Awaited<ReturnType<typeof getResolvedSkillFromRegistry>>) {
    const now = new Date().toISOString();
    return {
        slug: resolved.id,
        name: resolved.name,
        version: resolved.version,
        description: resolved.description,
        tags: resolved.tags ?? [],
        requiredTools: resolved.requiredTools ?? [],
        suggestedTools: resolved.suggestedTools ?? [],
        extends: resolved.extends ?? [],
        body: resolved.resolvedSystemPrompt,
        source: "builtin" as const,
        author: resolved.author,
        outputFormat: resolved.outputFormat,
        maxToolCalls: resolved.maxToolCalls,
        createdAt: now,
        updatedAt: now,
        /** Resolved-only fields (when loaded from filesystem registry, not Mongo). */
        resolvedTools: resolved.resolvedTools,
        extendsChain: resolved.extendsChain,
    };
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ slug: string }> }
) {
    const auth = await requireAppRouteAuth(request);
    const { slug } = await params;

    const url = new URL(request.url);
    const workspaceId = url.searchParams.get("workspaceId")?.trim();
    let workspaceRootPath: string | undefined;
    if (workspaceId && auth?.userId) {
        const ws = await getWorkspaceById(workspaceId, auth.userId);
        workspaceRootPath = ws?.rootPath?.trim();
    }

    const skill = await getSkillBySlug(slug, {
        ...(workspaceRootPath ? { workspaceRootPath } : {}),
    });
    if (skill) {
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

    try {
        const resolved = await getResolvedSkillFromRegistry(slug);
        return NextResponse.json({ skill: skillFromRegistry(slug, resolved) });
    } catch {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
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
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("workspaceId")?.trim();
        let workspaceRootPath: string | undefined;
        if (workspaceId) {
            const ws = await getWorkspaceById(workspaceId, auth.userId);
            workspaceRootPath = ws?.rootPath?.trim();
        }
        const body = await request.json();
        const validated = skillUpdateSchema.parse(body);
        const updated = await updateSkill(slug, validated, auth.userId, {
            ...(workspaceRootPath ? { workspaceRootPath } : {}),
        });
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
        const url = new URL(request.url);
        const workspaceId = url.searchParams.get("workspaceId")?.trim();
        let workspaceRootPath: string | undefined;
        if (workspaceId) {
            const ws = await getWorkspaceById(workspaceId, auth.userId);
            workspaceRootPath = ws?.rootPath?.trim();
        }
        const ok = await deleteSkill(slug, auth.userId, {
            ...(workspaceRootPath ? { workspaceRootPath } : {}),
        });
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
