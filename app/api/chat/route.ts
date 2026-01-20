import { NextResponse } from "next/server";

import { runAgentWorkflow } from "../../../src/agentRunner";

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof payload?.message === "string" ? payload.message.trim() : "";

  if (!message) {
    return NextResponse.json(
      { error: "Please provide a user message in the request body." },
      { status: 400 }
    );
  }

  try {
    const result = await runAgentWorkflow(message);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Internal agent failure." },
      { status: 500 }
    );
  }
}
