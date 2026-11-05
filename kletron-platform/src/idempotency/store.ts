import type { ToolCallSuccess } from "../shared/types.js";

interface Entry {
  key: string;
  fingerprint: string;
  response: ToolCallSuccess;
  createdAt: string;
}

function fingerprint(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, Object.keys(payload).sort());
}

export class IdempotencyStore {
  private readonly entries = new Map<string, Entry>();

  /**
   * Returns:
   * - cached response if same key + same payload
   * - 'conflict' if same key + different payload
   * - null if new
   */
  lookup(
    key: string,
    payload: Record<string, unknown>,
  ): { kind: "hit"; response: ToolCallSuccess } | { kind: "conflict" } | null {
    const existing = this.entries.get(key);
    if (!existing) return null;
    const fp = fingerprint(payload);
    if (existing.fingerprint !== fp) return { kind: "conflict" };
    return {
      kind: "hit",
      response: { ...existing.response, fromIdempotencyCache: true },
    };
  }

  put(key: string, payload: Record<string, unknown>, response: ToolCallSuccess): void {
    this.entries.set(key, {
      key,
      fingerprint: fingerprint(payload),
      response,
      createdAt: new Date().toISOString(),
    });
  }
}
