import { NextRequest, NextResponse } from "next/server";

import { getDb } from "@kletron/server/lib/db";
import { normalizeAuditContext, type AuditContext } from "@kletron/shared/documentContext";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@kletron/server/services/workspaceService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COLLECTION = "audit_context_config";

type ContextConfigDoc = {
  workspaceId: string;
  enabled: boolean;
  context: AuditContext | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
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

    const db = await getDb();
    const doc = await db.collection(COLLECTION).findOne({ workspaceId }, { projection: { _id: 0 } });
    if (!doc) {
      return NextResponse.json({ enabled: true, context: null });
    }
    return NextResponse.json({
      enabled: Boolean((doc as any).enabled),
      context: normalizeAuditContext((doc as any).context) ?? null,
      updatedAt: (doc as any).updatedAt,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to load context config" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      enabled?: boolean;
      context?: AuditContext | null;
    };

    const workspace = await resolveWorkspaceFromRequest(req, auth.userId, body as any);
    if (!workspace || !workspace._id) {
      return new Response(JSON.stringify({ error: "Workspace not configured" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const workspaceId = workspace._id.toString();

    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
    const normalized = normalizeAuditContext(body.context) ?? null;
    const now = new Date();

    const db = await getDb();
    const col = db.collection<ContextConfigDoc>(COLLECTION);
    await col.updateOne(
      { workspaceId },
      {
        $set: {
          workspaceId,
          enabled,
          context: normalized,
          updatedAt: now,
        },
        $setOnInsert: { createdAt: now },
      } as any,
      { upsert: true }
    );

    return NextResponse.json({ success: true, enabled, context: normalized, updatedAt: now });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Failed to save context config" }, { status: 400 });
  }
}
