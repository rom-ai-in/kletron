// apps/web/app/api/work-categories/current/route.ts
import { NextResponse } from "next/server";
import { categoryService } from "@kletron/server/services/categoryService";
import { isValidWorkModeId, normalizeToWorkModeId, type WorkModeId } from "@kletron/shared/workMode";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

/**
 * GET /api/work-categories/current?workspaceId=optional
 * Returns current Code vs Work mode for the user (optionally scoped to a workspace).
 * Auth: NextAuth session (browser) or Bearer / IDE token (desktop).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId")?.trim() || undefined;

    const result = await categoryService.getCurrentCategory(userId, workspaceId);

    if (!result) {
      return NextResponse.json({
        success: true,
        data: null,
      });
    }

    const workMode = normalizeToWorkModeId(result) as WorkModeId;

    return NextResponse.json({
      success: true,
      data: workMode,
    });
  } catch (error) {
    console.error("Error fetching current category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/work-categories/current
 * Body: { workMode: "code" | "work", workspaceId?: string }
 * Persists mode without sending a chat message.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAppRouteAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = auth.userId;
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const raw =
      typeof body.workMode === "string"
        ? body.workMode.trim()
        : typeof body.category === "string"
          ? body.category.trim()
          : "";
    if (!raw) {
      return NextResponse.json({ error: "workMode (or category) is required" }, { status: 400 });
    }
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId.trim() : undefined;

    const workMode = normalizeToWorkModeId(raw);
    if (!isValidWorkModeId(workMode)) {
      return NextResponse.json({ error: "Invalid workMode" }, { status: 400 });
    }

    await categoryService.setCurrentCategory(userId, workMode, workspaceId);

    return NextResponse.json({
      success: true,
      data: { workMode },
    });
  } catch (error) {
    console.error("Error setting current category:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
