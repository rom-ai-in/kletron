#!/usr/bin/env python3
"""Kletron — rebrand au BUILD (modèle VSCodium / Cursor sur VS Code).

Copies a git ref of the repository into a throw-away build directory and rewrites, in that copy only,
the product name inside DISPLAYED string literals, following rules.yaml. Repository sources are never
touched. Python is tokenized (tokenize), TS/TSX parsed with the TypeScript compiler (ts-literals.cjs),
YAML catalogs rewritten value by value, HTML outside tags/scripts. Literals used as data (comparisons,
matchers, keys, paths, raw strings…) are skipped and reported; --check fails when a skipped literal is
has no reviewed decision in data-literals.txt (new upstream literal to review).

    apply.py --ref kletron --out /workspace/kletron/_out/tree      # export + rebrand (deterministic)
    apply.py --in-place DIR                                         # re-apply on a tree (idempotence: 0 change)
    apply.py ... --check                                            # exit 2: data literal without decision / stale decision
    apply.py --ref kletron --out DIR --with-tests                   # VERIFICATION tree: tests renamed too (never shipped)
Outputs (next to the tree): rebrand-report.json, rebrand-manifest.sha256 — no timestamps, sorted.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import keyword
import os
import re
import shutil
import subprocess
import sys
import tarfile
import tokenize
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]


def load_rules(path: Path) -> dict:
    from ruamel.yaml import YAML  # upstream dependency (hermes_yaml); PyYAML is not installed

    return YAML(typ="safe", pure=True).load(path.read_text(encoding="utf-8"))


def glob_re(pattern: str) -> re.Pattern:
    out, i = "", 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out, i = out + "(?:.*/)?", i + 3
        elif pattern.startswith("**", i):
            out, i = out + ".*", i + 2
        elif pattern[i] == "*":
            out, i = out + "[^/]*", i + 1
        else:
            out, i = out + re.escape(pattern[i]), i + 1
    return re.compile(out + r"\Z")


def _block_lines(path: Path) -> list[str]:
    return [ln for ln in path.read_text(encoding="utf-8").splitlines() if ln and not ln.startswith("#")]


class Engine:
    def __init__(self, rules: dict):
        self.rules = rules
        self.keep = [re.compile(k, re.IGNORECASE) for k in rules["keep"]]
        self.compiled = [(r["id"], re.compile(r["pattern"]), r["replacement"], set(r["scope"])) for r in rules["rules"]]
        self.rule_files = {r["id"]: [glob_re(g) for g in r.get("files", [])] for r in rules["rules"]}
        self.rule_overrides = {r["id"]: set(r.get("overrides", [])) for r in rules["rules"]}
        self.rule_only_data = {r["id"] for r in rules["rules"] if r.get("only_data")}
        self.blocks = []
        for b in rules.get("blocks", []):
            src, dst = (_block_lines(HERE / b[k]) for k in ("from", "to"))
            if len(src) != len(dst):
                raise SystemExit(f"rebrand: block {b['id']}: {len(src)} != {len(dst)} lines")
            self.blocks.append((b["id"], list(zip(src, dst)), set(b["scope"])))
        self.needles = ["Hermes", "[hermes]"] + [a for _, pairs, _ in self.blocks for a, _ in pairs]
        self.decisions: dict[str, str] = {}
        self.with_tests = False
        self.applied_decisions: list[str] = []
        sc = rules["scopes"]
        self.excl = [glob_re(g) for g in sc["exclude"]]
        self.scopes = {k: [glob_re(g) for g in v["include"]] for k, v in sc.items() if k not in ("exclude", "tests")}
        self.test_globs = [glob_re(g) for g in sc.get("tests", [])]
        self.stats = {"replaced": 0, "kept": 0, "files_changed": 0}
        self.by_rule: dict[str, int] = {}
        self.skipped: list[dict] = []
        self.changed: list[dict] = []

    def scope_of(self, rel: str) -> str | None:
        if self.with_tests and self.is_test(rel) and not rel.startswith("kletron/"):
            return "python" if rel.endswith(".py") else "ts" if rel.endswith((".ts", ".tsx")) else None
        if any(r.match(rel) for r in self.excl):
            return None
        for name, pats in self.scopes.items():
            if any(p.match(rel) for p in pats):
                return name
        return None

    def rewrite(self, text: str, scope: str, rel: str = "", reason: str | None = None) -> tuple[str, int]:
        """Apply the ordered rules to one literal; returns (new, n). With *reason* (a data literal), only the
        rules that explicitly override that reason for this file run."""
        total = 0
        if reason is None:  # exact ASCII-art rows first (never data, never contain the KEEP patterns)
            for bid, pairs, scopes in self.blocks:
                if scope in scopes:
                    for a, b in pairs:
                        if a in text:
                            n = text.count(a)
                            text = text.replace(a, b)
                            self.by_rule[bid] = self.by_rule.get(bid, 0) + n
                            total += n
        if any(k.search(text) for k in self.keep):
            if self.compiled[-1][1].search(text):
                self.stats["kept"] += 1
            return text, total
        for rid, rx, repl, scopes in self.compiled:
            if scope not in scopes:
                continue
            if self.rule_files[rid] and not any(g.match(rel) for g in self.rule_files[rid]):
                continue
            if reason is not None and reason.split(":")[0] not in self.rule_overrides[rid]:
                continue
            if reason is None and rid in self.rule_only_data:
                continue
            text, n = rx.subn(repl, text)
            if n:
                self.by_rule[rid] = self.by_rule.get(rid, 0) + n
                total += n
            if any(k.search(text) for k in self.keep):
                break
        return text, total

    def wants(self, text: str) -> bool:
        return any(rx.search(text) for rid, rx, _, _ in self.compiled) and not any(k.search(text) for k in self.keep)

    def data_literal(self, rel: str, line: int, reason: str, text: str, scope: str) -> str:
        """A literal used as data: only the rules that override *reason* for this file run, unless a reviewed
        decision says `rewrite` (all rules). The decision is looked up on the ORIGINAL text, so a second pass on
        the output finds nothing left to do (idempotence)."""
        if not self.wants(text) and not any(self.rule_overrides[rid] for rid in self.rule_overrides):
            return text
        fp = fingerprint(rel, reason, text)
        decision = self.decisions.get(fp)
        if self.with_tests and self.is_test(rel) and not rel.startswith("kletron/"):
            decision = "rewrite"  # VERIFICATION tree: upstream tests assert on product output, they follow it
            self.applied_decisions.append(fp)
            new, n = self.rewrite(text, scope, rel)
            self.stats["replaced"] += n
            self.by_rule["decision:rewrite"] = self.by_rule.get("decision:rewrite", 0) + n
            return new
        new, n = self.rewrite(text, scope, rel, reason)
        self.stats["replaced"] += n
        if n and decision is None:  # covered by a rule that explicitly overrides this reason (reviewed with the rule)
            return new
        if not self.wants(new):
            if decision:
                self.applied_decisions.append(fp)
            return new
        self.skipped.append({"file": rel, "line": line, "reason": reason, "text": text[:160], "fp": fp,
                             "decision": decision or ("test" if self.is_test(rel) else None)})
        return new

    def is_test(self, rel: str) -> bool:
        return any(r.match(rel) for r in self.test_globs)


def fingerprint(rel: str, reason: str, text: str) -> str:
    return f"{rel}|{reason}|{hashlib.sha1(text.encode()).hexdigest()[:12]}"


# ---------------------------------------------------------------- Python
PY_MATCHERS = {"startswith", "endswith", "find", "rfind", "index", "rindex", "count", "replace", "split", "rsplit",
               "partition", "rpartition", "strip", "lstrip", "rstrip", "removeprefix", "removesuffix", "compile",
               "match", "fullmatch", "search", "sub", "subn", "findall", "finditer", "escape", "getenv", "get", "pop",
               "setdefault", "getattr", "hasattr", "setattr", "delattr", "which", "Path", "PurePath", "PurePosixPath",
               "PureWindowsPath", "joinpath", "join", "user_data_dir", "user_config_dir", "user_cache_dir",
               "user_log_dir", "set_password", "get_password", "delete_password", "get_credential", "__contains__",
               "glob", "rglob", "fnmatch", "is_relative_to", "with_name", "with_suffix", "assertIn", "assertEqual"}
PATHISH = re.compile(r"Application Support|AppData|Hermes\.app|[\\/]Hermes|Hermes[\\/]|\.desktop\b|\bHKEY_|\bCN=")
CMP = {"==", "!=", "in", "is", "not"}


def py_literals(src: str):
    """Yield (start, end, line, reason|None) for every string piece holding text."""
    toks = [t for t in tokenize.generate_tokens(io.StringIO(src).readline)]
    lines = src.splitlines(keepends=True)
    base = [0]
    for ln in lines:
        base.append(base[-1] + len(ln))

    def off(pos):
        return base[pos[0] - 1] + pos[1]

    raw = [t for t in toks if t.type not in (tokenize.NL, tokenize.COMMENT)]
    raw_at = {id(t): k for k, t in enumerate(raw)}

    def is_docstring(t) -> bool:  # a string that is a whole statement: shown by help(), --help, tool schemas
        k = raw_at[id(t)]
        before = raw[k - 1].type if k else tokenize.ENCODING
        after = raw[k + 1].type if k + 1 < len(raw) else tokenize.ENDMARKER
        return before in (tokenize.NEWLINE, tokenize.INDENT, tokenize.DEDENT, tokenize.ENCODING) and \
            after in (tokenize.NEWLINE, tokenize.ENDMARKER)

    sig = [t for t in toks if t.type not in (tokenize.NL, tokenize.NEWLINE, tokenize.COMMENT, tokenize.INDENT,
                                               tokenize.DEDENT, tokenize.ENCODING)]
    FS_START = {getattr(tokenize, n) for n in ("FSTRING_START", "TSTRING_START") if hasattr(tokenize, n)}
    FS_MID = {getattr(tokenize, n) for n in ("FSTRING_MIDDLE", "TSTRING_MIDDLE") if hasattr(tokenize, n)}
    FS_END = {getattr(tokenize, n) for n in ("FSTRING_END", "TSTRING_END") if hasattr(tokenize, n)}
    stack: list[tuple[str, str]] = []  # (bracket, callee)
    i = 0
    while i < len(sig):
        t = sig[i]
        if t.type == tokenize.OP and t.string in "([{":
            prev = sig[i - 1] if i else None
            callee = prev.string if (t.string == "(" and prev is not None and prev.type == tokenize.NAME) else ""
            stack.append((t.string, callee))
        elif t.type == tokenize.OP and t.string in ")]}":
            if stack:
                stack.pop()
        if t.type == tokenize.STRING or t.type in FS_START:
            j, pieces = i, []
            if t.type == tokenize.STRING:
                prefix = re.match(r"[A-Za-z]*", t.string).group(0).lower()
                q = len(prefix) + (3 if t.string[len(prefix):len(prefix) + 3] in ('"""', "'''") else 1)
                pieces.append((off(t.start) + q, off(t.end) - q, t.start[0], t.string[q:-q], prefix))
            else:
                prefix = re.match(r"[A-Za-z]*", t.string).group(0).lower()
                depth = 0
                j = i + 1
                while j < len(sig):
                    u = sig[j]
                    if u.type in FS_START:
                        depth += 1
                    elif u.type in FS_END:
                        if depth == 0:
                            break
                        depth -= 1
                    elif u.type in FS_MID and depth == 0:
                        a, b = off(u.start), off(u.end)
                        pieces.append((a, b, u.start[0], u.string, prefix))
                    j += 1
            prev = sig[i - 1] if i else None
            nxt = sig[j + 1] if j + 1 < len(sig) else None
            reason = None
            doc = t.type == tokenize.STRING and is_docstring(t)
            if "r" in prefix or "b" in prefix:
                reason = "raw-string"
            elif (prev is not None and prev.string in CMP) or (nxt is not None and nxt.string in CMP):
                reason = "comparison"
            elif prev is not None and prev.type == tokenize.NAME and prev.string == "case":
                reason = "switch-case"
            elif prev is not None and prev.string == "[" and i >= 2 and (
                    (sig[i - 2].type == tokenize.NAME and not keyword.iskeyword(sig[i - 2].string))
                    or sig[i - 2].type == tokenize.STRING or sig[i - 2].string in (")", "]")):
                reason = "subscript"
            elif nxt is not None and nxt.string == ":" and stack and stack[-1][0] == "{":
                reason = "dict-key"
            elif (prev is not None and prev.string in ("(", ",")) and stack and stack[-1][0] == "(" and stack[-1][1] in PY_MATCHERS:
                reason = f"matcher:{stack[-1][1]}"
            elif (prev is not None and prev.string == "/") or (nxt is not None and nxt.string == "/"):
                reason = "path"
            for a, b, line, text, _p in pieces:
                r = reason
                if r is None and not doc and PATHISH.search(text):
                    r = "path"
                if r is None and src[a:b] != text and src[a:b].replace("{{", "{").replace("}}", "}") != text:
                    r = "fstring-position"
                yield a, b, line, r
            i = j
        i += 1


def rebrand_python(eng: Engine, rel: str, src: str) -> str:
    out, last = [], 0
    for a, b, line, reason in py_literals(src):
        piece = src[a:b]
        if reason:
            new, n = eng.data_literal(rel, line, reason, piece, "python"), 0
        else:
            new, n = eng.rewrite(piece, "python", rel)
            eng.stats["replaced"] += n
        if new != piece:
            out.append(src[last:a]); out.append(new); last = b
    out.append(src[last:])
    return "".join(out)


# ---------------------------------------------------------------- TS / TSX (TypeScript AST via node)
def ts_spans(root: Path, files: list[str], needles: list[str]) -> dict[str, list[dict]]:
    if not files:
        return {}
    env = {**os.environ, "KLETRON_REBRAND_NEEDLES": json.dumps(needles)}
    proc = subprocess.run(["node", str(HERE / "ts-literals.cjs"), str(root)], input="\n".join(files),
                          capture_output=True, text=True, cwd=REPO, check=True, env=env)
    return {d["file"]: d["spans"] for d in map(json.loads, proc.stdout.splitlines())}


def rebrand_spans(eng: Engine, rel: str, src: str, spans: list[dict], scope: str) -> str:
    out, last = [], 0
    for s in sorted(spans, key=lambda s: s["start"]):
        a, b = s["start"], s["end"]
        piece = src[a:b]
        reason = s["skip"] or ("path" if PATHISH.search(piece) else None)
        if reason:
            new = eng.data_literal(rel, s["line"], reason, piece, scope)
        else:
            new, n = eng.rewrite(piece, scope, rel)
            eng.stats["replaced"] += n
        if new != piece:
            out.append(src[last:a]); out.append(new); last = b
    out.append(src[last:])
    return "".join(out)


# ---------------------------------------------------------------- YAML catalogs (values only)
YAML_KEY = re.compile(r"^(\s*(?:-\s+)?[\w.\-\"']+\s*:\s?)(.*)$")


def rebrand_yaml(eng: Engine, rel: str, src: str) -> str:
    out = []
    for line in src.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("#") or "Hermes" not in line:
            out.append(line)
            continue
        m = YAML_KEY.match(line.rstrip("\n"))
        head, val = (m.group(1), m.group(2)) if m else ("", line.rstrip("\n"))
        new, n = eng.rewrite(val, "yaml", rel)
        eng.stats["replaced"] += n
        out.append(head + new + ("\n" if line.endswith("\n") else ""))
    return "".join(out)


# ---------------------------------------------------------------- JSON / JSONL (string values only, never keys)
JSON_STR = re.compile(r'"(?:[^"\\\n]|\\.)*"')


def rebrand_json(eng: Engine, rel: str, src: str) -> str:
    out, last = [], 0
    for m in JSON_STR.finditer(src):
        rest = src[m.end():m.end() + 40].lstrip()
        if rest.startswith(":"):
            continue  # key
        new, n = eng.rewrite(m.group(0)[1:-1], "json", rel)
        if n:
            eng.stats["replaced"] += n
            out.append(src[last:m.start() + 1]); out.append(new); last = m.end() - 1
    out.append(src[last:])
    return "".join(out)


# ---------------------------------------------------------------- HTML (text outside tags/scripts/styles)
HTML_SPLIT = re.compile(r"(<script\b.*?</script>|<style\b.*?</style>|<!--.*?-->|<[^>]*>)", re.DOTALL | re.IGNORECASE)


def rebrand_html(eng: Engine, rel: str, src: str) -> str:
    parts = HTML_SPLIT.split(src)
    for k in range(0, len(parts), 2):
        new, n = eng.rewrite(parts[k], "html", rel)
        parts[k] = new
        eng.stats["replaced"] += n
    return "".join(parts)


# ---------------------------------------------------------------- driver
def export_ref(ref: str, out: Path) -> None:
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)
    data = subprocess.run(["git", "archive", "--format=tar", ref], cwd=REPO, capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(data)) as tf:
        tf.extractall(out, filter="tar")


def list_files(root: Path) -> list[str]:
    return sorted(p.relative_to(root).as_posix() for p in root.rglob("*")
                  if p.is_file() and not p.is_symlink() and "node_modules" not in p.parts)


def run(root: Path, eng: Engine) -> None:
    files = list_files(root)
    by_scope: dict[str, list[str]] = {}
    for rel in files:
        sc = eng.scope_of(rel)
        if sc:
            by_scope.setdefault(sc, []).append(rel)
    def wanted(src: str) -> bool:
        return any(n in src for n in eng.needles)

    ts_files = [f for f in by_scope.get("ts", []) if wanted((root / f).read_text(encoding="utf-8", errors="replace"))]
    spans = ts_spans(root, ts_files, eng.needles)
    for sc in sorted(by_scope):
        for rel in by_scope[sc]:
            p = root / rel
            try:
                src = p.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            if not wanted(src):
                continue
            before = eng.stats["replaced"]
            if sc == "python":
                new = rebrand_python(eng, rel, src)
                compile(new, rel, "exec", dont_inherit=True, flags=0x400 if False else 0)  # syntax must survive
            elif sc == "ts":
                new = rebrand_spans(eng, rel, src, spans.get(rel, []), "ts")
            elif sc == "yaml":
                new = rebrand_yaml(eng, rel, src)
            elif sc == "json":
                new = rebrand_json(eng, rel, src)
            else:
                new = rebrand_html(eng, rel, src)
            if new != src:
                p.write_text(new, encoding="utf-8")
                eng.stats["files_changed"] += 1
                eng.changed.append({"file": rel, "replaced": eng.stats["replaced"] - before})


def manifest(root: Path) -> str:
    lines = []
    for rel in list_files(root):
        lines.append(f"{hashlib.sha256((root / rel).read_bytes()).hexdigest()}  {rel}")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--ref", help="git ref to export (e.g. kletron)")
    g.add_argument("--in-place", type=Path, help="re-apply on an existing tree (idempotence check)")
    ap.add_argument("--out", type=Path, help="build tree directory (with --ref); must be outside the repo")
    ap.add_argument("--rules", type=Path, default=HERE / "rules.yaml")
    ap.add_argument("--decisions", type=Path, default=HERE / "data-literals.txt",
                    help="reviewed data literals: <fingerprint>  keep|rewrite  # why")
    ap.add_argument("--with-tests", action="store_true",
                    help="VERIFICATION tree only: also rewrite the tests, so they check the renamed strings consistently")
    ap.add_argument("--check", action="store_true", help="exit 2 if a data literal has no reviewed decision")
    a = ap.parse_args()
    if a.ref:
        if not a.out:
            ap.error("--out is required with --ref")
        out = a.out.resolve()
        if out == REPO or REPO in out.parents:
            ap.error("--out must be outside the repository (sources are never modified)")
        if set(out.parts) & {"build", "dist", "node_modules", ".venv"}:
            ap.error("--out must not live under build/ dist/ node_modules/ .venv (wiped on box restart)")
        export_ref(a.ref, out)
        root = out
    else:
        root = a.in_place.resolve()
    eng = Engine(load_rules(a.rules))
    eng.with_tests = a.with_tests
    if a.decisions.exists():
        for ln in a.decisions.read_text(encoding="utf-8").splitlines():
            ln = ln.split("#", 1)[0].strip()
            if ln:
                fp, decision = ln.split()
                if decision not in ("keep", "rewrite"):
                    ap.error(f"bad decision {decision!r} in {a.decisions}")
                eng.decisions[fp] = decision
    run(root, eng)
    skipped = sorted(eng.skipped, key=lambda s: (s["file"], s["line"], s["fp"]))
    new = [x for x in skipped if x["decision"] is None]
    seen = {x["fp"] for x in skipped} | set(eng.applied_decisions)
    # Stale decisions only make sense on a fresh export (on an already rebranded tree every literal changed).
    stale = sorted(fp for fp in eng.decisions if fp not in seen) if a.ref else []
    report = {"rules_version": eng.rules["version"], "replaced": eng.stats["replaced"], "kept_attribution": eng.stats["kept"],
              "files_changed": eng.stats["files_changed"], "by_rule": dict(sorted(eng.by_rule.items())),
              "skipped": len(skipped), "skipped_by_reason": {}, "unreviewed": new, "stale_decisions": stale,
              "changed_files": eng.changed}
    for s in skipped:
        r = s["reason"].split(":")[0]
        report["skipped_by_reason"][r] = report["skipped_by_reason"].get(r, 0) + 1
    report["skipped_by_reason"] = dict(sorted(report["skipped_by_reason"].items()))
    side = root.parent
    if a.ref:
        (side / "rebrand-report.json").write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        (side / "rebrand-skipped.json").write_text(json.dumps(skipped, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        (side / "rebrand-manifest.sha256").write_text(manifest(root), encoding="utf-8")
    print(f"rebrand: {report['replaced']} replaced in {report['files_changed']} files; {len(skipped)} skipped "
          f"(data, {report['skipped_by_reason']}); {report['kept_attribution']} kept (attribution); "
          f"{len(new)} unreviewed; {len(stale)} stale decisions")
    for s in new[:40]:
        print(f"  UNREVIEWED {s['file']}:{s['line']} [{s['reason']}] {s['text'][:90]!r}")
    for fp in stale:
        print(f"  STALE {fp} (literal gone upstream: remove the line)")
    return 2 if a.check and (new or stale) else 0


if __name__ == "__main__":
    sys.exit(main())
