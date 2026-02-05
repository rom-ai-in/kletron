import { NextResponse } from "next/server";
import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";

export async function GET(request: Request, context: { params: { runId: string } }) {
  const auth = await requireAppRouteAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runId } = context.params;
  if (!runId) {
    return NextResponse.json({ error: "Missing runId" }, { status: 400 });
  }

  const diffHunk = `@@ -1,3 +1,4 @@\n+Added line in run ${runId}`;
  return NextResponse.json({ diffHunk });
}
