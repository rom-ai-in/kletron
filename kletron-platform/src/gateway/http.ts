import express from "express";
import type { GatewayService } from "./service.js";
import type { ToolCallRequest } from "../shared/types.js";

export function createGatewayApp(gateway: GatewayService): express.Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "kletron-mcp-gateway" });
  });

  app.post("/mcp/tools/call", async (req, res) => {
    const body = req.body as ToolCallRequest;
    if (!body?.callId || !body?.principal || !body?.connector) {
      res.status(400).json({ ok: false, reason: "invalid_request", message: "Malformed tools/call" });
      return;
    }
    const result = await gateway.toolsCall(body);
    res.status(result.ok ? 200 : 403).json(result);
  });

  app.post("/mcp/approvals/:id/decide", (req, res) => {
    const decision = req.body?.decision as "approved" | "rejected";
    const decidedBy = String(req.body?.decidedBy ?? "validator");
    if (decision !== "approved" && decision !== "rejected") {
      res.status(400).json({ error: "decision must be approved|rejected" });
      return;
    }
    try {
      const record = gateway.decideApproval(req.params.id, decision, decidedBy);
      res.json(record);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  app.post("/mcp/danger/direct-call", (req, res) => {
    const { connector, resource, action, payload } = req.body ?? {};
    const result = gateway.attemptDirectConnectorCall(
      connector,
      resource,
      action,
      payload ?? {},
    );
    res.status(403).json(result);
  });

  return app;
}
