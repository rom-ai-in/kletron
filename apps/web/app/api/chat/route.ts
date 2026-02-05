import { NextResponse } from "next/server";

import { runWorkflow } from "@numezis/agent-core/workflows";
import { normalizeAuditContext, type AuditContext } from "@numezis/shared/documentContext";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function POST(request: Request) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return new Response(JSON.stringify({"error": "Unauthorized"}), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";
  const graph = typeof payload?.graph === "string" ? payload.graph.trim() : undefined;
  const auditContext = normalizeAuditContext(
    (payload as { auditContext?: AuditContext }).auditContext
  );

  if (!message) {
    return NextResponse.json(
      { error: "Please provide a user message in the request body." },
      { status: 400 }
    );
  }

  try {
    const result = await runWorkflow(message, graph, { auditContext });
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Internal agent failure." },
      { status: 500 }
    );
  }
}
