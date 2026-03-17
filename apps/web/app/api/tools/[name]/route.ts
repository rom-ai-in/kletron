import path from "node:path";
import fs from "node:fs/promises";

import { NextResponse } from "next/server";
import { mcpToolMetadata } from "@kletron/agent-core/tools/mcpToolMetadata";
import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";

export async function GET(
  _request: Request,
  { params }: { params: { name?: string } }
) {

  const auth = await requireAppRouteAuth(_request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const toolName = params?.name;
  if (!toolName) {
    return NextResponse.json({ error: "Tool name is required." }, { status: 400 });
  }

  const tool = mcpToolMetadata.find((entry) => entry.name === toolName);
  if (!tool) {
    return NextResponse.json({ error: "Tool not found." }, { status: 404 });
  }

  const repoRoot = process.cwd();
  const resolvedPath = path.resolve(repoRoot, tool.file);
  try {
    const code = await fs.readFile(resolvedPath, "utf-8");
    return NextResponse.json({
      name: tool.name,
      label: tool.label,
      description: tool.description,
      file: tool.file,
      code,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: `Unable to read tool code: ${(error as Error).message ?? "unknown"}` },
      { status: 500 }
    );
  }
}
