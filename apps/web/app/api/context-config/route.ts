import { NextRequest, NextResponse } from "next/server";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import {
  getWorkspaceContextConfig,
  saveWorkspaceContextConfig,
  type SaveWorkspaceContextConfigInput,
} from "@kletron/server/services/auditContextService";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const workspace = await resolveWorkspaceFromRequest(request, auth.userId, null);
    if (!workspace || !workspace._id) {
      return new Response(JSON.stringify({ error: "Workspace not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const workspaceId = workspace._id.toString();
    const config = await getWorkspaceContextConfig(workspaceId);
    if (!config) {
      return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
    }
    return NextResponse.json({
      enabled: config.enabled,
      context: config.context,
      injection: config.injection,
      ...(config.updatedAt ? { updatedAt: config.updatedAt } : {}),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to load context config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as SaveWorkspaceContextConfigInput;

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body as any);
    if (!workspace || !workspace._id) {
      return new Response(JSON.stringify({ error: "Workspace not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const workspaceId = workspace._id.toString();

    const saved = await saveWorkspaceContextConfig(workspaceId, body);

    return NextResponse.json({
      success: true,
      enabled: saved.enabled,
      context: saved.context,
      injection: saved.injection,
      updatedAt: saved.updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to save context config" }, { status: 400 });
  }
}
