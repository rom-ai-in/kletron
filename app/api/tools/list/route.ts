import { NextResponse } from "next/server";

import { mcpToolMetadata } from "../../../../src/tools/mcpToolMetadata";
import { requireAppRouteAuth } from "@/src/lib/auth/apiAuth";

export async function GET(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return NextResponse.json(mcpToolMetadata);
}
