# Windows signing / MSIX publisher (Kletron)

## Current state (box, 5 nov 2026)

Upstream out-of-store MSIX publisher string (ATS cert subject) is still:

`CN=Nous Research Inc., O=Nous Research Inc., L=Austin, S=Texas, C=US`

Source: `scripts/msix-shared.mjs` → `OUT_OF_STORE_PUBLISHER`.

No Kletron code-signing certificate is present on this box. **No production
signature was generated, and none will be invented.**

## What is required before a Windows client release

1. Obtain a code-signing certificate for the Kletron / Numezis legal entity
   (Authenticode / Azure Trusted Signing). Subject CN must match the MSIX
   publisher string.
2. Set build secrets only in a protected CI environment (never in git):
   - `CSC_LINK` / `CSC_KEY_PASSWORD` (or Azure Trusted Signing vars)
   - optionally `AZURE_SIGN_PUBLISHER`
3. Change `OUT_OF_STORE_PUBLISHER` (and Store publisher if used) to the real
   Kletron subject **in a reviewed patch or build overlay**, after legal/IT OK.
4. Produce signed MSIX / App Installer on a Windows runner; Linux can only
   assemble unsigned payloads or cross-pack with Wine (not a release proof).

## Explicit non-goals on the box

- Do not generate a self-signed cert and call it production.
- Do not commit `.pfx` / `.p12` / private keys.
- Do not point update feeds at Nous Research (already neutralized by patch 0002).
