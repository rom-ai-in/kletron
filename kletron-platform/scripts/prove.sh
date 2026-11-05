#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROOF_DIR="$ROOT/proofs"
mkdir -p "$PROOF_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$PROOF_DIR/prove-$STAMP.txt"

{
  echo "=== Kletron platform local proof ==="
  echo "date_europe_zurich: $(TZ=Europe/Zurich date -R)"
  echo "node: $(node -v)"
  echo "npm: $(npm -v)"
  echo
  echo "=== typecheck ==="
  npm run typecheck
  echo
  echo "=== tests ==="
  npm test
  echo
  echo "=== litellm config generate ==="
  npm run litellm:config -- "$PROOF_DIR/litellm.generated.yaml"
  echo
  echo "=== journal append-only sample ==="
  node --import tsx -e '
    import { mkdtempSync } from "node:fs";
    import { tmpdir } from "node:os";
    import { join } from "node:path";
    import { AppendOnlyJournal } from "./src/journal/journal.ts";
    const dir = mkdtempSync(join(tmpdir(), "kletron-j-"));
    const j = new AppendOnlyJournal(dir);
    j.append({ kind: "config_served", actor: "prove" });
    j.append({ kind: "tool_deny", reason: "default_deny", actor: "prove" });
    console.log("journal_path", j.path);
    console.log("events", JSON.stringify(j.readAll(), null, 2));
  '
  echo
  echo "PROOF_OK"
} | tee "$OUT"

echo "Wrote $OUT"
