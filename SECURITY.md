# Security policy

## Supported versions

We triage security issues for the **default branch** (`main`). Tags/releases may lag; if you need a backport, say so in the report.

## Reporting a vulnerability

**Please do not open a public GitHub issue** for security vulnerabilities.

Instead:

1. Open a **private security advisory** on GitHub (Repository → **Security** → **Advisories** → **Report a vulnerability**), or
2. Email **security@kletron.com** with subject `[SECURITY] Kletron` and include:
   - description and impact
   - reproduction steps (minimal)
   - suggested fix (optional)

We aim to acknowledge within **72 hours** and coordinate disclosure.

## Scope (examples)

In scope: authentication/session issues, remote code execution via agent/MCP paths, credential leakage, insecure defaults in shipped configs.

Out of scope: social engineering, spam, theoretical issues without a practical exploit, third-party dependency advisories unless Kletron uses the vulnerable surface.

## Safe harbor

If you make a good-faith effort to follow this policy, we will not pursue legal action for accidental, non-destructive research.
