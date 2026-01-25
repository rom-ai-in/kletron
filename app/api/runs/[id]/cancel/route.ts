import { NextRequest, NextResponse } from "next/server";
import { chainExecutor } from "@/src/services/chainExecutor";

/**
 * POST /api/runs/[id]/cancel
 * Cancel a specific execution run (best-effort: takes effect between stages)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runId = params.id;

    const run = await chainExecutor.getRun(runId);
    if (!run) {
      return NextResponse.json({ error: "Execution run not found" }, { status: 404 });
    }

    if (run.status === "COMPLETED" || run.status === "FAILED" || run.status === "CANCELLED") {
      return NextResponse.json(
        { error: `Run is not cancellable (status: ${run.status})` },
        { status: 400 }
      );
    }

    await chainExecutor.cancelRun(runId);
    return NextResponse.json({ status: "CANCELLED", runId }, { status: 200 });
  } catch (error) {
    console.error(`[API /api/runs/${params.id}/cancel POST] Error:`, error);
    return NextResponse.json({ error: "Failed to cancel run" }, { status: 500 });
  }
}

