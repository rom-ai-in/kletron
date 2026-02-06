export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";

import { requireAppRouteAuth } from "@numezis/server/lib/auth/apiAuth";
import { resolveWorkspaceFromRequest } from "@numezis/server/services/workspaceService";
import { ConversationService } from "@numezis/server/services/agent/ConversationService";
import { agentGraphService } from "@numezis/server/services/agentGraphService";
import { getDb } from "@numezis/server/lib/db";
import { chainExecutor } from "@numezis/server/services/chainExecutor";

export type HistoryRunItem = {
  id: string;
  type: "explore" | "deep_agent" | "graph" | "campaign" | "drift";
  title: string;
  status: string;
  startedAt: string;
  endedAt?: string | null;
  link: string;
  graphId?: string;
  graphName?: string;
  campaignId?: string;
  workspaceId: string;
};

const normalizeType = (value?: string) => {
  const t = (value || "").toLowerCase();
  if (t === "explore" || t === "deep_agent" || t === "graph" || t === "campaign" || t === "drift") return t;
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
  const campaignId = searchParams.get("campaignId") || undefined;

  const workspaceId = workspace._id.toString();
  const results: HistoryRunItem[] = [];

  const shouldIncludeType = (type: HistoryRunItem["type"]) => {
    if (typeFilter === "all") return true;
    return typeFilter === type;
  };

  try {
    if (typeFilter === "all" || typeFilter === "explore") {
      const service = new ConversationService(workspaceId);
      const conversations = await service.list();
      for (const conv of conversations) {
        const item: HistoryRunItem = {
          id: conv.id,
          type: "explore",
          title: conv.title || "Explore Session",
          status: conv.status,
          startedAt: conv.createdAt,
          endedAt: conv.status === "archived" ? conv.updatedAt : null,
          link: `/app/explore?conversationId=${encodeURIComponent(conv.id)}`,
          workspaceId,
        };
        results.push(item);
      }
    }

    const db = await getDb();
    const workspaceObjectId = new ObjectId(workspaceId);

    if (typeFilter === "all" || typeFilter === "deep_agent" || typeFilter === "graph" || typeFilter === "campaign" || typeFilter === "drift") {
      const runQuery: any = { workspaceId: workspaceObjectId };
      if (graphId) {
        if (!ObjectId.isValid(graphId)) {
          return NextResponse.json({ error: "Invalid graphId" }, { status: 400 });
        }
        runQuery.graphId = new ObjectId(graphId);
      }

      const graphRuns = await db
        .collection("agent_graph_runs")
        .find(runQuery)
        .sort({ startedAt: -1 })
        .limit(Math.min(limit * 2, 200))
        .toArray();

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
        const category = (graphInfo?.category || "graph") as HistoryRunItem["type"];
        const runType: HistoryRunItem["type"] =
          category === "deep_agent"
            ? "deep_agent"
            : category === "campaign"
            ? "campaign"
            : category === "drift"
            ? "drift"
            : "graph";

        if (!shouldIncludeType(runType)) continue;

        results.push({
          id: run._id?.toString?.() ?? "",
          type: runType,
          title: run?.state?.userInput || run?.state?.mission || graphInfo?.name || "Agent Graph Run",
          status: run.status,
          startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : "",
          endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
          link: `/app/agent-graphs/${runGraphId}/runs/${run._id?.toString?.() ?? ""}`,
          graphId: runGraphId,
          graphName: graphInfo?.name,
          workspaceId,
        });
      }
    }

    if (typeFilter === "all" || typeFilter === "campaign") {
      const runQuery: any = { workspaceId: workspaceObjectId };
      if (campaignId) {
        if (!ObjectId.isValid(campaignId)) {
          return NextResponse.json({ error: "Invalid campaignId" }, { status: 400 });
        }
        runQuery.chainId = new ObjectId(campaignId);
      }

      const auditRuns = await db
        .collection("audit_runs")
        .find(runQuery)
        .sort({ startedAt: -1 })
        .limit(Math.min(limit * 2, 200))
        .toArray();

      const chains = await chainExecutor.listChains({ workspaceId });
      const chainMap = new Map<string, string>();
      for (const chain of chains) {
        if (chain._id) chainMap.set(String(chain._id), chain.name || "Campaign");
      }

      for (const run of auditRuns) {
        const chainId = run.chainId?.toString?.() || "";
        results.push({
          id: run._id?.toString?.() ?? "",
          type: "campaign",
          title: chainMap.get(chainId) || "Campaign Run",
          status: run.status,
          startedAt: run.startedAt ? new Date(run.startedAt).toISOString() : "",
          endedAt: run.endedAt ? new Date(run.endedAt).toISOString() : null,
          link: `/app/runs/${run._id?.toString?.() ?? ""}`,
          campaignId: chainId,
          workspaceId,
        });
      }
    }
  } catch (error) {
    console.error("[API /api/history/runs GET] Error:", error);
    // Fail soft to avoid breaking UI on transient DB issues.
    return NextResponse.json({ runs: [] }, { status: 200 });
  }

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

  return NextResponse.json({ runs: filtered.slice(0, limit) }, { status: 200 });
}
