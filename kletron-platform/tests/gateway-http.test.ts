import request from "supertest";
import { describe, expect, it } from "vitest";
import { alice, freshRuntime } from "./helpers.js";

describe("gateway HTTP", () => {
  it("POST /mcp/tools/call allows bexio contacts read for Alice", async () => {
    const rt = freshRuntime();
    const res = await request(rt.gatewayApp)
      .post("/mcp/tools/call")
      .send({
        callId: "http-read-1",
        principal: alice,
        connector: "bexio",
        resource: "contacts",
        action: "read",
        payload: {},
      })
      .expect(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.result)).toBe(true);
  });

  it("refus lecture factures sans grant explicite delete etc.", async () => {
    const rt = freshRuntime();
    const res = await request(rt.gatewayApp)
      .post("/mcp/tools/call")
      .send({
        callId: "http-deny-1",
        principal: alice,
        connector: "m365",
        resource: "mail",
        action: "write",
        payload: { subject: "nope" },
        idempotencyKey: "x",
      })
      .expect(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.reason).toBe("default_deny");
  });
});
