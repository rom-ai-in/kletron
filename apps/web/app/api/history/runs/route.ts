export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { agentGraphService } from "@numezis/server/services/agentGraphService";
import { getDb } from "@numezis/server/lib/db";
import { automationExecutor } from "@numezis/server/services/automationExecutor";

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
  // Legacy compatibility
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

  const workspace = await resolveWorkspaceFromRequest(req, auth.userId, null);
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
  console.log(`[history/runs] workspaceId=${workspaceId}, type=${typeFilter}, status=${statusFilter}, q=${queryFilter}, limit=${limit}`);

  const shouldIncludeType = (type: HistoryRunItem["type"]) => {
    if (typeFilter === "all") return true;
    return typeFilter === type;
  };

  try {
    const db = await getDb();
    const workspaceObjectId = new ObjectId(workspaceId);

    if (typeFilter === "all" || typeFilter === "agent" || typeFilter === "graph" || typeFilter === "automation" || typeFilter === "drift") {
      const runQuery: any = { workspaceId: workspaceObjectId };
      if (graphId) {
        if (!ObjectId.isValid(graphId)) {
          return NextResponse.json({ error: "Invalid graphId" }, { status: 400 });
        }
        runQuery.graphId = new ObjectId(graphId);
      }
      console.log(`[history/runs] Querying agent_graph_runs:`, JSON.stringify(runQuery, (_, v) => v instanceof ObjectId ? v.toString() : v));

      const graphRuns = await db
        .collection("agent_graph_runs")
        .find(runQuery)
        .sort({ startedAt: -1 })
        .limit(Math.min(limit * 2, 200))
        .toArray();
      console.log(`[history/runs] Found ${graphRuns.length} graph runs`);

      const graphs = await agentGraphService.listGraphs();
      const graphMap = new Map<string, { name: string; category?: string }>();
      for (const graph of graphs) {
        if (graph._id) {
          graphMap.set(String(graph._id), { name: graph.name, category: graph.category });
        }
      }

      for (const run of graphRuns) {
        const runGraphId = run.graphId?.toString?.() || "";
        const graphInfo = graphMap.get(runGraphId);
        const category = (graphInfo?.category || "graph") as string;
        const runType: HistoryRunItem["type"] =
          category === "deep_agent" || category === "graph"
            ? "agent"
            : category === "automation"
            ? "automation"
            : category === "drift"
            ? "drift"
            : "agent";

        if (!shouldIncludeType(runType)) continue;

        results.push({
          id: run._id?.toString?.() ?? "",
          type: runType,
          title: run?.title || run?.state?.userInput || run?.state?.mission || graphInfo?.name || "Agent Session",
          status: run.status,
          startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : "",
          endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
          link: `/app/agent?sessionId=${run._id?.toString?.() ?? ""}`,
          graphId: runGraphId,
          graphName: graphInfo?.name,
          workspaceId,
        });
      }
    }

    if (typeFilter === "all" || typeFilter === "automation") {
      const runQuery: any = { workspaceId: workspaceObjectId };
      if (automationId) {
        if (!ObjectId.isValid(automationId)) {
          return NextResponse.json({ error: "Invalid automationId" }, { status: 400 });
        }
        runQuery.chainId = new ObjectId(automationId);
      }

      const auditRuns = await db
        .collection("audit_runs")
        .find(runQuery)
        .sort({ startedAt: -1 })
        .limit(Math.min(limit * 2, 200))
        .toArray();

      const automations = await automationExecutor.listAutomations({ workspaceId });
      const automationMap = new Map<string, string>();
      for (const automation of automations) {
        if (automation._id) automationMap.set(String(automation._id), automation.name || "Automation");
      }

      for (const run of auditRuns) {
        const runAutomationId = run.chainId?.toString?.() || "";
        results.push({
          id: run._id?.toString?.() ?? "",
          type: "automation",
          title: automationMap.get(runAutomationId) || "Automation Run",
          status: run.status,
          startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : "",
          endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
          link: `/app/runs/${run._id?.toString?.() ?? ""}`,
          automationId: runAutomationId,
          workspaceId,
        });
      }
    }
  } catch (error) {
    console.error("[history/runs] ✗ Error:", error);
    // Fail soft to avoid breaking UI on transient DB issues.
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
