import request from "supertest";
import { describe, expect, it } from "vitest";
import { alice, freshRuntime } from "./helpers.js";

describe("Console API", () => {
  it("GET /v1/config/self returns locked config", async () => {
    const rt = freshRuntime();
    const res = await request(rt.consoleApp)
      .get("/v1/config/self")
      .query({ profile: "default", employeeId: alice.employeeId })
      .expect(200);

    expect(res.body.clientId).toBe("demo-client");
    expect(res.body.locks.yoloMode).toBe(false);
    expect(res.body.locks.telemetry).toBe(false);
    expect(res.body.locks.directConnectorAccess).toBe(false);
    expect(res.body.models.providerStage).toBe("beta");
    expect(res.body.gatewayUrl).toContain("7101");
    expect(res.body.stops.global).toBe(false);
  });

  it("employee/client/global stops update state and journal", async () => {
    const rt = freshRuntime();
    await request(rt.consoleApp)
      .post("/v1/stops/employee/emp-alice")
      .send({ active: true, by: "admin" })
      .expect(200);
    await request(rt.consoleApp)
      .post("/v1/stops/client")
      .send({ active: true, by: "admin" })
      .expect(200);
    await request(rt.consoleApp)
      .post("/v1/stops/global")
      .send({ active: true, by: "admin" })
      .expect(200);

    const stops = await request(rt.consoleApp).get("/v1/stops").expect(200);
    expect(stops.body.global).toBe(true);
    expect(stops.body.client).toBe(true);
    expect(stops.body.employees["emp-alice"]).toBe(true);

    const cfg = await request(rt.consoleApp)
      .get("/v1/config/self")
      .query({ employeeId: "emp-alice" })
      .expect(200);
    expect(cfg.body.stops).toEqual({
      global: true,
      client: true,
      employee: true,
    });

    const kinds = rt.journal.readAll().map((e) => e.kind);
    expect(kinds.filter((k) => k === "stop_set").length).toBeGreaterThanOrEqual(3);
  });
});
