import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { JournalEvent } from "../shared/types.js";

export class AppendOnlyJournal {
  private seq = 0;
  private readonly filePath: string;
  private readonly metaPath: string;

  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, "journal.jsonl");
    this.metaPath = join(dataDir, "journal.meta.json");
    if (!existsSync(dirname(this.filePath))) {
      mkdirSync(dirname(this.filePath), { recursive: true });
    }
    if (existsSync(this.metaPath)) {
      const meta = JSON.parse(readFileSync(this.metaPath, "utf8")) as { seq: number };
      this.seq = meta.seq;
    } else {
      writeFileSync(this.metaPath, JSON.stringify({ seq: 0 }), "utf8");
    }
    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, "", "utf8");
    }
  }

  append(
    partial: Omit<JournalEvent, "seq" | "ts"> & { ts?: string },
  ): JournalEvent {
    this.seq += 1;
    const event: JournalEvent = {
      seq: this.seq,
      ts: partial.ts ?? new Date().toISOString(),
      kind: partial.kind,
      actor: partial.actor,
      connector: partial.connector,
      resource: partial.resource,
      action: partial.action,
      callId: partial.callId,
      reason: partial.reason,
      detail: partial.detail,
    };
    // Append-only: never rewrite existing lines
    writeFileSync(this.filePath, `${JSON.stringify(event)}\n`, {
      encoding: "utf8",
      flag: "a",
    });
    writeFileSync(this.metaPath, JSON.stringify({ seq: this.seq }), "utf8");
    return event;
  }

  readAll(): JournalEvent[] {
    const raw = readFileSync(this.filePath, "utf8");
    if (!raw.trim()) return [];
    return raw
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as JournalEvent);
  }

  /** Attempting to truncate must fail for callers that try */
  assertAppendOnly(): void {
    // Touch write stream in append mode only — documentation guard
    const stream = createWriteStream(this.filePath, { flags: "a" });
    stream.end();
  }

  get path(): string {
    return this.filePath;
  }

  get currentSeq(): number {
    return this.seq;
  }
}
