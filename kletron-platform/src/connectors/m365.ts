import type { Action, ResourceId } from "../shared/types.js";
import { assertGatewayOnly, type ConnectorCallContext } from "./bexio.js";

const MAIL = [
  {
    id: "m365-m-1",
    subject: "Demo standup notes",
    from: "alice@example.invalid",
    preview: "Synthetic mail body",
  },
];

const CALENDAR = [
  {
    id: "m365-cal-1",
    subject: "Demo planning",
    start: "2026-11-06T09:00:00+01:00",
    end: "2026-11-06T09:30:00+01:00",
  },
];

const FILES = [
  { id: "m365-f-1", name: "demo-brief.md", path: "/Demo/demo-brief.md" },
];

export function m365Execute(
  resource: ResourceId,
  action: Action,
  payload: Record<string, unknown>,
  ctx: ConnectorCallContext,
): unknown {
  assertGatewayOnly(ctx);

  if (resource !== "mail" && resource !== "calendar" && resource !== "files") {
    throw new Error(`m365 mock does not expose resource ${resource}`);
  }

  if (action === "read") {
    if (resource === "mail") return MAIL;
    if (resource === "calendar") return CALENDAR;
    return FILES;
  }

  if (action === "write" && resource === "mail") {
    const draft = {
      id: `m365-m-${Date.now()}`,
      subject: String(payload.subject ?? "(no subject)"),
      from: "agent@example.invalid",
      preview: String(payload.body ?? ""),
      status: "draft",
    };
    MAIL.push(draft);
    return draft;
  }

  throw new Error(`Unsupported m365 action ${action} on ${resource}`);
}
