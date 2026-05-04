// Global Skills Library
//
// GET  /api/skills            -> list skills (built-in + the caller's user skills)
//     ?workspaceId=&executable=1 -> skills the agent can run for that workspace (slash / load_skill)
// POST /api/skills            -> create a new user skill (SKILL.md)
//
// Auth: requireAppRouteAuth. Anonymous + dev-bypass requests get only built-ins.

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
    createSkill,
    listSkills,
    resolveWorkspaceSkills,
} from "@kletron/server/services/skillsService";
import { getWorkspaceById } from "@kletron/server/services/workspaceService";
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

        let workspaceRootPath: string | undefined;
        const workspaceId = url.searchParams.get("workspaceId")?.trim();
        if (workspaceId && auth?.userId) {
            const ws = await getWorkspaceById(workspaceId, auth.userId);
            workspaceRootPath = ws?.rootPath?.trim();
        }

        /** Same slugs the agent can load (slash preflight, load_skill, workspace caps). */
        const wantExecutable =
            url.searchParams.get("executable") === "1" ||
            url.searchParams.get("executable") === "true";
        if (wantExecutable) {
            if (!workspaceId) {
                return NextResponse.json(
                    { error: "executable=1 requires workspaceId" },
                    { status: 400 }
                );
            }
            if (!auth?.userId) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            const ws = await getWorkspaceById(workspaceId, auth.userId);
            if (!ws) {
                return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
            }
            const records = await resolveWorkspaceSkills(workspaceId);
            return NextResponse.json({ skills: records });
        }

        const records = await listSkills({
            tag: url.searchParams.get("tag") ?? undefined,
            search: url.searchParams.get("search") ?? undefined,
            source:
                (url.searchParams.get("source") as "builtin" | "user" | null) ??
                undefined,
            viewerUserId,
            limit: Number(url.searchParams.get("limit") ?? 200),
            ...(workspaceRootPath ? { workspaceRootPath } : {}),
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
        const body = (await request.json()) as Record<string, unknown>;
        const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
        const { workspaceId: _w, ...skillBody } = body;
        const validated = skillCreateSchema.parse(skillBody);
        let workspaceRootPath: string | undefined;
        if (workspaceId && auth.userId) {
            const ws = await getWorkspaceById(workspaceId, auth.userId);
            workspaceRootPath = ws?.rootPath?.trim();
            if (!workspaceRootPath) {
                return NextResponse.json(
                    { error: "Workspace not found or has no root path." },
                    { status: 400 }
                );
            }
        }
        const skill = await createSkill(validated, auth.userId, {
            ...(workspaceRootPath ? { workspaceRootPath } : {}),
        });
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
