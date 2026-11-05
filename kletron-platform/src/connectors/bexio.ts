import type { Action, ResourceId } from "../shared/types.js";

/** Synthetic C0 demo data — never production */
const CONTACTS = [
  { id: "bx-c-1", name: "Acme Demo SA", email: "demo@example.invalid" },
  { id: "bx-c-2", name: "Beta Sample GmbH", email: "beta@example.invalid" },
];

const INVOICES = [
  { id: "bx-i-1", contactId: "bx-c-1", amount: 1200, currency: "CHF", status: "open" },
  { id: "bx-i-2", contactId: "bx-c-2", amount: 450, currency: "CHF", status: "paid" },
];

export interface ConnectorCallContext {
  /** Only the gateway may set this */
  gatewayToken: string;
  expectedToken: string;
}

export function assertGatewayOnly(ctx: ConnectorCallContext): void {
  if (!ctx.gatewayToken || ctx.gatewayToken !== ctx.expectedToken) {
    const err = new Error("Direct connector call forbidden — use MCP gateway");
    (err as Error & { code: string }).code = "direct_call_forbidden";
    throw err;
  }
}

export function bexioExecute(
  resource: ResourceId,
  action: Action,
  payload: Record<string, unknown>,
  ctx: ConnectorCallContext,
): unknown {
  assertGatewayOnly(ctx);

  if (resource !== "contacts" && resource !== "invoices") {
    throw new Error(`bexio mock does not expose resource ${resource}`);
  }

  if (action === "read") {
    if (resource === "contacts") {
      const id = payload.id as string | undefined;
      return id ? CONTACTS.find((c) => c.id === id) ?? null : CONTACTS;
    }
    const id = payload.id as string | undefined;
    return id ? INVOICES.find((i) => i.id === id) ?? null : INVOICES;
  }

  if (action === "write" && resource === "contacts") {
    const name = String(payload.name ?? "Untitled Demo");
    const created = {
      id: `bx-c-${Date.now()}`,
      name,
      email: String(payload.email ?? "new@example.invalid"),
    };
    CONTACTS.push(created);
    return created;
  }

  if (action === "write" && resource === "invoices") {
    const created = {
      id: `bx-i-${Date.now()}`,
      contactId: String(payload.contactId ?? "bx-c-1"),
      amount: Number(payload.amount ?? 0),
      currency: "CHF",
      status: "draft",
    };
    INVOICES.push(created);
    return created;
  }

  throw new Error(`Unsupported bexio action ${action} on ${resource}`);
}
