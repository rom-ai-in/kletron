import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { getActiveWorkspace, setActiveWorkspaceFromPath } from "@numezis/server/services/workspaceService";
import { McpClient } from "@numezis/mcp-client/client";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const workspace = await getActiveWorkspace(auth.userId);
    return NextResponse.json({
      workingFolder: workspace?.rootPath ?? "",
      workspaceId: workspace?._id?.toString() ?? null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to load config" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const folderPath = (body as any).workingFolder || (body as any).mcpDefaultDir;
  const name = typeof (body as any).name === "string" ? (body as any).name : undefined;
  if (!folderPath) {
    return NextResponse.json({ error: "`workingFolder` is required" }, { status: 400 });
  }

  try {
    const workspace = await setActiveWorkspaceFromPath(auth.userId, String(folderPath), name);
    await McpClient.reloadInstance();
    return NextResponse.json({
      workingFolder: workspace.rootPath,
      workspaceId: workspace._id?.toString() ?? null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Failed to save config" },
      { status: 500 }
    );
  }
}
