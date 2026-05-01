export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppRouteAuth } from "@kletron/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequestStrict, workspaceErrorToHttp } from "@kletron/server/services/workspaceService";
import { agentGraphService } from "@kletron/server/services/agentGraphService";
import { automationExecutor } from "@kletron/server/services/automationExecutor";
import { getDb } from "@kletron/server/lib/db";

export type HistoryRunItem = {
  id: string;
  type: "agent" | "graph" | "automation" | "drift";
  title: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  link: string;
  graphId?: string;
  graphName?: string;
  automationId?: string;
  workspaceId: string;
};

const normalizeType = (value?: string) => {
  const t = (value || "").toLowerCase();
  if (t === "agent" || t === "graph" || t === "automation" || t === "drift") return t;
  if (t === "explore" || t === "deep_agent") return "agent";
  return "all";
};

export async function GET(req: NextRequest) {
  const auth = await requireAppRouteAuth(req);
  if (!auth) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let workspace = null;
  try {
    workspace = await resolveWorkspaceFromRequestStrict(req, auth.userId, null);
  } catch (error) {
    const workspaceError = workspaceErrorToHttp(error);
    if (workspaceError) {
      return NextResponse.json(workspaceError.body, { status: workspaceError.status });
    }
    throw error;
  }
  if (!workspace || !workspace._id) {
    return NextResponse.json({ error: "Workspace not configured" }, { status: 400 });
  }

  const searchParams = req.nextUrl.searchParams;
  const typeFilter = normalizeType(searchParams.get("type") || undefined);
  const statusFilter = searchParams.get("status")?.trim() || "";
  const queryFilter = searchParams.get("q")?.trim().toLowerCase() || "";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam))) : 50;
  const graphId = searchParams.get("graphId") || undefined;
  const automationId = searchParams.get("automationId") || undefined;

  const workspaceId = workspace._id.toString();
  const results: HistoryRunItem[] = [];
  console.log(
    `[history/runs] workspaceId=${workspaceId}, type=${typeFilter}, status=${statusFilter}, q=${queryFilter}, limit=${limit}`
  );

  const shouldIncludeType = (type: HistoryRunItem["type"]) => {
    if (typeFilter === "all") return true;
    return typeFilter === type;
  };

  try {
    const db = await getDb();
    const workspaceObjectId = new ObjectId(workspaceId);

    const runQuery: Record<string, unknown> = {
      workspaceId: workspaceObjectId,
      // Hide hidden automation sub-stage runs from the global history list.
      parentRunId: { $exists: false },
    };
    if (graphId) {
      if (!ObjectId.isValid(graphId)) {
        return NextResponse.json({ error: "Invalid graphId" }, { status: 400 });
      }
      runQuery.graphId = new ObjectId(graphId);
    }
    if (automationId) {
      if (!ObjectId.isValid(automationId)) {
        return NextResponse.json({ error: "Invalid automationId" }, { status: 400 });
      }
      runQuery.automationId = new ObjectId(automationId);
    }

    const runs = await db
      .collection("agent_graph_runs")
      .find(runQuery)
      .sort({ startedAt: -1 })
      .limit(Math.min(limit * 2, 200))
      .toArray();
    console.log(`[history/runs] Found ${runs.length} agent_graph_runs`);

    const graphs = await agentGraphService.listGraphs();
    const graphMap = new Map<string, { name: string; category?: string }>();
    for (const graph of graphs) {
      if (graph._id) {
        graphMap.set(String(graph._id), { name: graph.name, category: graph.category });
      }
    }

    const automations = await automationExecutor.listAutomations({ workspaceId });
    const automationMap = new Map<string, string>();
    for (const automation of automations) {
      if (automation._id) automationMap.set(String(automation._id), automation.name || "Automation");
    }

    for (const run of runs) {
      const runGraphId = run.graphId?.toString?.() || "";
      const runAutomationId = run.automationId?.toString?.();
      const graphInfo = graphMap.get(runGraphId);
      let runType: HistoryRunItem["type"];
      if (runAutomationId || run.source === "automation") {
        runType = "automation";
      } else {
        const category = (graphInfo?.category || "graph") as string;
        runType =
          category === "deep_agent" || category === "graph"
            ? "agent"
            : category === "automation"
            ? "automation"
            : category === "drift"
            ? "drift"
            : "agent";
      }

      if (!shouldIncludeType(runType)) continue;

      const titleFromAutomation = runAutomationId ? automationMap.get(runAutomationId) : undefined;
      const title =
        run?.title ||
        titleFromAutomation ||
        run?.state?.userInput ||
        run?.state?.mission ||
        graphInfo?.name ||
        "Agent Session";

      results.push({
        id: run._id?.toString?.() ?? "",
        type: runType,
        title,
        status: run.status,
        startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : "",
        endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
        link: `/app/agent?sessionId=${run._id?.toString?.() ?? ""}`,
        graphId: runGraphId,
        graphName: graphInfo?.name,
        ...(runAutomationId ? { automationId: runAutomationId } : {}),
        workspaceId,
      });
    }
  } catch (error) {
    console.error("[history/runs] ✗ Error:", error);
    return NextResponse.json({ runs: [] }, { status: 200 });
  }

  console.log(`[history/runs] Total results before filtering: ${results.length}`);
  const filtered = results.filter((item) => {
    if (!shouldIncludeType(item.type)) return false;
    if (statusFilter && item.status?.toLowerCase() !== statusFilter.toLowerCase()) return false;
    if (queryFilter) {
      const haystack = [item.title, item.graphName, item.id].join(" ").toLowerCase();
      if (!haystack.includes(queryFilter)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return bTime - aTime;
  });

  console.log(`[history/runs] Returning ${Math.min(filtered.length, limit)} runs (${filtered.length} after filter)`);
  return NextResponse.json({ runs: filtered.slice(0, limit) }, { status: 200 });
}
