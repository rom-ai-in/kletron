"""Kletron — build-time rebrand engine (kletron/build/rebrand, VSCodium/Cursor model).

Runs apply.py --in-place on a tiny synthetic tree: displayed literals are renamed, data literals
(comparisons, identifiers, paths, env vars, model names, attribution) are not, and a second pass is a no-op.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[3]
APPLY = ROOT / "kletron/build/rebrand/apply.py"
HERMES_LOGO_ROW = (ROOT / "kletron/build/rebrand/assets/logo-hermes-agent.txt").read_text(encoding="utf-8").splitlines()[1]
KLETRON_LOGO_ROW = (ROOT / "kletron/build/rebrand/assets/logo-kletron-agent.txt").read_text(encoding="utf-8").splitlines()[1]

PY = f'''import os
HERMES_HOME = os.path.expanduser("~/.hermes")
LOGO = """[bold]{HERMES_LOGO_ROW}[/]"""
def f(prog, name, model):
    # Hermes comment stays
    print("Welcome to Hermes Agent!")
    print(f"Hermes is running {{prog}}")
    if prog == "Hermes":
        return os.getenv("HERMES_TOKEN")
    if model == "Hermes 4":
        return r"Hermes\\d"
    return {{"Hermes": "Hermes Agent by Nous Research"}}
'''
TSX = f'''import {{ x }} from 'Hermes'
const LOGO = ['{HERMES_LOGO_ROW}   ']
export const A = () => <div className="Hermes">🚀 Hermes is ready</div>
export function g(s: string) {{ return s === 'Hermes' ? `Hermes ${{s}} 🚀 Hermes` : 'Restart Hermes' }}
export const v = (o: string) => o.match(/^\\s*Hermes Agent\\s+(\\S+)/m)
export const w = (e: string) => `${{e}}\\n\\nHermes retries them`
'''
YAML = 'Hermes:\n  title: "Hermes Desktop"\n  model: "Hermes 3"\n'


def _tree(tmp_path: Path) -> Path:
    root = tmp_path / "tree"
    for rel, text in {"hermes_cli/x.py": PY, "apps/desktop/src/x.tsx": TSX, "locales/en.yaml": YAML,
                      "tests/test_x.py": 'assert "Hermes"\n',
                      "apps/desktop/src/components/chat/intro-copy.jsonl": '{"Hermes": "Hi, Hermes here"}\n'}.items():
        (root / rel).parent.mkdir(parents=True, exist_ok=True)
        (root / rel).write_text(text, encoding="utf-8")
    return root


def _apply(root: Path) -> int:
    out = subprocess.run([sys.executable, str(APPLY), "--in-place", str(root), "--decisions", "/dev/null"],
                         check=True, capture_output=True, text=True, cwd=ROOT, timeout=120).stdout
    return int(re.search(r"rebrand: (\d+) replaced", out).group(1))


@pytest.fixture(scope="module")
def tree(tmp_path_factory):
    root = _tree(tmp_path_factory.mktemp("rebrand"))
    n = _apply(root)
    return root, n


def test_python_displayed_vs_data(tree):
    root, _ = tree
    py = (root / "hermes_cli/x.py").read_text(encoding="utf-8")
    assert 'print("Welcome to Kletron Agent!")' in py
    assert 'print(f"Kletron is running {prog}")' in py
    for kept in ('"~/.hermes"', "# Hermes comment stays", 'prog == "Hermes"', '"HERMES_TOKEN"', '"Hermes 4"',
                 'r"Hermes\\d"', '{"Hermes": "Hermes Agent by Nous Research"}', "HERMES_HOME ="):
        assert kept in py, kept
    assert KLETRON_LOGO_ROW in py and HERMES_LOGO_ROW not in py
    compile(py, "x.py", "exec")


def test_tsx_displayed_vs_data(tree):
    root, _ = tree
    tsx = (root / "apps/desktop/src/x.tsx").read_text(encoding="utf-8")
    assert "🚀 Kletron is ready</div>" in tsx  # JSX text, after an astral char (UTF-16 vs code point offsets)
    assert "'Restart Kletron'" in tsx and "`Kletron ${s} 🚀 Kletron`" in tsx
    for kept in ("from 'Hermes'", 'className="Hermes"', "s === 'Hermes'"):
        assert kept in tsx, kept
    assert KLETRON_LOGO_ROW in tsx
    # regex literals are consumers (they read backend output): they accept both names
    assert "/^\\s*(?:Kletron|Hermes) Agent\\s+(\\S+)/m" in tsx
    assert "\\n\\nKletron retries them" in tsx  # escape sequence before the word


def test_json_values_only(tree):
    root, _ = tree
    assert (root / "apps/desktop/src/components/chat/intro-copy.jsonl").read_text(encoding="utf-8") == \
        '{"Hermes": "Hi, Kletron here"}\n'


def test_yaml_values_only_and_tests_untouched(tree):
    root, _ = tree
    assert (root / "locales/en.yaml").read_text(encoding="utf-8") == 'Hermes:\n  title: "Kletron Desktop"\n  model: "Hermes 3"\n'
    assert (root / "tests/test_x.py").read_text(encoding="utf-8") == 'assert "Hermes"\n'


def test_idempotent(tree):
    root, n = tree
    assert n >= 6
    assert _apply(root) == 0


def test_refuses_output_inside_repo(tmp_path):
    r = subprocess.run([sys.executable, str(APPLY), "--ref", "HEAD", "--out", str(ROOT / "x-out")],
                       capture_output=True, text=True, cwd=ROOT, timeout=60, check=False)
    assert r.returncode != 0 and "outside the repository" in r.stderr
    assert not (ROOT / "x-out").exists()
