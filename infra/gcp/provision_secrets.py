#!/usr/bin/env python3
"""
Push Kletron runtime secrets from repo-root .env into GCP Secret Manager and
grant the Cloud Run default runtime SA secretAccessor.

Does not print secret values.

Usage (from repo root):
  python3 infra/gcp/provision_secrets.py

Optional: pass Google OAuth client secret without storing in .env first:
  GOOGLE_OAUTH_CLIENT_SECRET='…' python3 infra/gcp/provision_secrets.py
"""

from __future__ import annotations

import os
import re
import subprocess
import sys
import urllib.parse
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
ENV_PATH = ROOT / ".env"
PROJECT_ID = os.environ.get("GCP_PROJECT_ID", "kletron")
EXPECTED_PROJECT = os.environ.get("GCP_EXPECTED_PROJECT", "kletron")
REGION = os.environ.get("GCP_REGION", "europe-west6")
SERVICE = os.environ.get("GCP_WEB_SERVICE", "kletron-web")
ALLOW_NON_KLETRON_PROJECT = os.environ.get("GCP_ALLOW_NON_KLETRON_PROJECT", "").strip().lower() in ("1", "true", "yes")


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        print(f"Missing {path}", file=sys.stderr)
        sys.exit(1)
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        out[key.strip()] = val.strip()
    return out


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def run_stdin(cmd: list[str], data: bytes) -> None:
    subprocess.run(cmd, input=data, check=True)


def ensure_expected_project() -> None:
    if PROJECT_ID == EXPECTED_PROJECT or ALLOW_NON_KLETRON_PROJECT:
        return
    print(
        f"Refusing to update project '{PROJECT_ID}'. Expected '{EXPECTED_PROJECT}'. "
        "Override explicitly with GCP_ALLOW_NON_KLETRON_PROJECT=true.",
        file=sys.stderr,
    )
    sys.exit(1)


def cloud_run_service_url(service: str) -> str | None:
    proc = subprocess.run(
        [
            "gcloud",
            "run",
            "services",
            "describe",
            service,
            "--project",
            PROJECT_ID,
            "--region",
            REGION,
            "--format=value(status.url)",
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        return None
    url = proc.stdout.strip().rstrip("/")
    return url or None


def project_number() -> str:
    p = subprocess.run(
        ["gcloud", "projects", "describe", PROJECT_ID, "--format=value(projectNumber)"],
        check=True,
        capture_output=True,
        text=True,
    )
    return p.stdout.strip()


def upsert_secret(secret_id: str, value: str) -> None:
    proc = subprocess.run(
        [
            "gcloud",
            "secrets",
            "create",
            secret_id,
            "--project",
            PROJECT_ID,
            "--data-file=-",
            "--replication-policy=automatic",
        ],
        input=value.encode("utf-8"),
        capture_output=True,
    )
    if proc.returncode == 0:
        return
    run_stdin(
        [
            "gcloud",
            "secrets",
            "versions",
            "add",
            secret_id,
            "--project",
            PROJECT_ID,
            "--data-file=-",
        ],
        value.encode("utf-8"),
    )


def grant_accessor(secret_id: str, member: str) -> None:
    subprocess.run(
        [
            "gcloud",
            "secrets",
            "add-iam-policy-binding",
            secret_id,
            "--project",
            PROJECT_ID,
            "--member",
            member,
            "--role",
            "roles/secretmanager.secretAccessor",
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def patch_nextauth_in_env(text: str, new_secret: str) -> str:
    def repl(m: re.Match[str]) -> str:
        indent = m.group(1)
        return f"{indent}NEXTAUTH_SECRET={new_secret}"

    out, n = re.subn(
        r"^(\s*)NEXTAUTH_SECRET=.*$",
        repl,
        text,
        flags=re.MULTILINE,
    )
    if n == 0:
        out = text.rstrip() + f"\nNEXTAUTH_SECRET={new_secret}\n"
    return out


def resolve_public_web_url(env: dict[str, str]) -> str:
    """HTTPS origin for Next.js public URL + NextAuth (no trailing slash)."""
    override = os.environ.get("KLETRON_WEB_URL", "").strip().rstrip("/")
    if override.startswith("https://"):
        return override
    override = os.environ.get("NUMEZIS_WEB_URL", "").strip().rstrip("/")
    if override.startswith("https://"):
        return override
    for key in ("NEXT_PUBLIC_APP_URL", "NEXTAUTH_URL"):
        raw = env.get(key, "").strip().rstrip("/")
        if raw.startswith("https://"):
            return raw
    live_url = cloud_run_service_url(SERVICE)
    if live_url:
        return live_url
    # Last resort: default Cloud Run hostname (update after first deploy if needed).
    return os.environ.get(
        "NUMEZIS_WEB_FALLBACK_URL",
        os.environ.get(
            "KLETRON_WEB_FALLBACK_URL",
            "https://www.kletron.com",
        ),
    ).strip().rstrip("/")


def build_mongodb_uri(env: dict[str, str]) -> str | None:
    user = env.get("MONGODB_USER", "").strip()
    password = env.get("MONGODB_PASS", "").strip()
    uri = env.get("MONGODB_URI", "").strip()
    if not user or not password or not uri:
        return None
    # Already contains credentials
    if "@" in uri.replace("mongodb+srv://", "", 1):
        return uri
    m = re.match(r"mongodb\+srv://([^/@]+)(/.*)?$", uri)
    if not m:
        return None
    host = m.group(1).rstrip("/")
    tail = (m.group(2) or "").strip()
    if not tail or tail == "/":
        tail = "/kletron"
    u = urllib.parse.quote(user, safe="")
    p = urllib.parse.quote(password, safe="")
    return f"mongodb+srv://{u}:{p}@{host}{tail}"


def main() -> None:
    ensure_expected_project()
    env = load_env(ENV_PATH)
    google_secret_early = (
        os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
        or env.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    )
    if "--google-secret-only" in sys.argv:
        if not google_secret_early:
            print(
                "Set GOOGLE_OAUTH_CLIENT_SECRET (env var or .env) or paste client secret from Google Console.",
                file=sys.stderr,
            )
            sys.exit(1)
        pn = project_number()
        member = f"serviceAccount:{pn}-compute@developer.gserviceaccount.com"
        upsert_secret("kletron-google-oauth-client-secret", google_secret_early)
        grant_accessor("kletron-google-oauth-client-secret", member)
        run(
            [
                "gcloud",
                "run",
                "services",
                "update",
                SERVICE,
                "--project",
                PROJECT_ID,
                "--region",
                REGION,
                "--update-secrets",
                "GOOGLE_OAUTH_CLIENT_SECRET=kletron-google-oauth-client-secret:latest",
            ]
        )
        print(f"Attached GOOGLE_OAUTH_CLIENT_SECRET to {SERVICE} ({REGION}).")
        return

    raw_text = ENV_PATH.read_text(encoding="utf-8")

    nextauth = env.get("NEXTAUTH_SECRET", "")
    if not nextauth or nextauth.startswith("change-this"):
        import secrets as pysecrets

        nextauth = pysecrets.token_urlsafe(48)
        ENV_PATH.write_text(patch_nextauth_in_env(raw_text, nextauth), encoding="utf-8")
        env = load_env(ENV_PATH)

    mongo_uri = build_mongodb_uri(env)
    if not mongo_uri:
        print("Could not build MONGODB_URI (need MONGODB_USER, MONGODB_PASS, MONGODB_URI host).", file=sys.stderr)
        sys.exit(1)

    azure_key = env.get("AZURE_OPENAI_API_KEY", "").strip()
    if not azure_key:
        print("Missing AZURE_OPENAI_API_KEY in .env", file=sys.stderr)
        sys.exit(1)

    google_id = env.get("GOOGLE_OAUTH_CLIENT_ID", "").strip()
    if not google_id:
        print("Missing GOOGLE_OAUTH_CLIENT_ID in .env", file=sys.stderr)
        sys.exit(1)

    google_secret = (
        os.environ.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
        or env.get("GOOGLE_OAUTH_CLIENT_SECRET", "").strip()
    )

    tavily = env.get("TAVILY_API_KEY", "").strip()
    langsmith = env.get("LANGSMITH_API_KEY", "").strip()

    pn = project_number()
    runtime_sa = f"{pn}-compute@developer.gserviceaccount.com"
    member = f"serviceAccount:{runtime_sa}"

    pairs: list[tuple[str, str]] = [
        ("kletron-nextauth-secret", nextauth),
        ("kletron-mongodb-uri", mongo_uri),
        ("kletron-google-oauth-client-id", google_id),
        ("kletron-azure-openai-api-key", azure_key),
    ]
    if google_secret:
        pairs.append(("kletron-google-oauth-client-secret", google_secret))
    else:
        print(
            "WARN: GOOGLE_OAUTH_CLIENT_SECRET empty — OAuth Drive/Gmail/Calendar will fail until you run:\n"
            "  GOOGLE_OAUTH_CLIENT_SECRET='…' python3 infra/gcp/provision_secrets.py --google-secret-only\n"
            "or add the secret in .env and re-run this script.",
            file=sys.stderr,
        )
    if tavily:
        pairs.append(("kletron-tavily-api-key", tavily))
    if langsmith:
        pairs.append(("kletron-langsmith-api-key", langsmith))

    for sid, val in pairs:
        upsert_secret(sid, val)
        grant_accessor(sid, member)

    web_url = resolve_public_web_url(env)
    cors = env.get("KLETRON_CORS_ALLOWLIST", "").strip()
    if web_url not in cors:
        cors = ",".join(x for x in (web_url, cors) if x)

    env_pairs = [
        "AUTH_TRUST_HOST=true",
        "NEXT_TELEMETRY_DISABLED=1",
        f"NEXT_PUBLIC_APP_URL={web_url}",
        f"NEXTAUTH_URL={web_url}",
        f"AZURE_OPENAI_ENDPOINT={env.get('AZURE_OPENAI_ENDPOINT', '').strip()}",
        f"AZURE_OPENAI_MODEL={env.get('AZURE_OPENAI_MODEL', '').strip()}",
        f"AZURE_OPENAI_DEPLOYMENT={env.get('AZURE_OPENAI_DEPLOYMENT', '').strip()}",
        f"AZURE_OPENAI_API_VERSION={env.get('AZURE_OPENAI_API_VERSION', '').strip()}",
        f"AZURE_OPENAI_MAX_TOKENS={env.get('AZURE_OPENAI_MAX_TOKENS', '4096').strip()}",
        f"GRAPH_RECURSION_LIMIT={env.get('GRAPH_RECURSION_LIMIT', '200').strip()}",
        f"LANGSMITH_TRACING={env.get('LANGSMITH_TRACING', 'false').strip()}",
        f"LANGSMITH_ENDPOINT={env.get('LANGSMITH_ENDPOINT', '').strip()}",
        f"LANGSMITH_PROJECT={env.get('LANGSMITH_PROJECT', '').strip()}",
        f"KLETRON_CORS_ALLOWLIST={cors}",
    ]
    # gcloud dict flags: see `gcloud topic escaping`. Use ^DELIM^ then DELIM between KEY=VALUE items.
    # Values include "https://" and commas (CORS). DELIM must not appear inside any value (avoid "--" in URLs/models).
    delim = "--"
    update_env_arg = f"^{delim}^" + f"{delim}".join(env_pairs)

    secret_refs = [
        "NEXTAUTH_SECRET=kletron-nextauth-secret:latest",
        "MONGODB_URI=kletron-mongodb-uri:latest",
        "GOOGLE_OAUTH_CLIENT_ID=kletron-google-oauth-client-id:latest",
        "AZURE_OPENAI_API_KEY=kletron-azure-openai-api-key:latest",
    ]
    if google_secret:
        secret_refs.append("GOOGLE_OAUTH_CLIENT_SECRET=kletron-google-oauth-client-secret:latest")
    if tavily:
        secret_refs.append("TAVILY_API_KEY=kletron-tavily-api-key:latest")
    if langsmith:
        secret_refs.append("LANGSMITH_API_KEY=kletron-langsmith-api-key:latest")

    update_cmd = [
        "gcloud",
        "run",
        "services",
        "update",
        SERVICE,
        "--project",
        PROJECT_ID,
        "--region",
        REGION,
        "--update-env-vars",
        update_env_arg,
        "--update-secrets",
        ",".join(secret_refs),
    ]
    run(update_cmd)
    print(f"Updated Cloud Run service {SERVICE} ({REGION}) with secrets + env.")


if __name__ == "__main__":
    main()
