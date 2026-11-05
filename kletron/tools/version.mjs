#!/usr/bin/env node
// Kletron version scheme: X.Y.Z-k.N (D-versioning, docs/06 §versioning).
//   X.Y.Z = last upstream release tag contained in upstream-base; N = Kletron build, from 1, reset per X.Y.Z.
// Derived forms (one source: kletron/VERSION):
//   desktop/semver : X.Y.Z-k.N           (electron-updater generic feed, semver.gt)
//   python/PEP 440 : X.Y.Z+k.N           (local version label; ordered by packaging)
//   msix quad      : upstream time-based quad (scripts/msix-shared.mjs::nativeQuad on vX.Y.Z) —
//                    monotonic by build time, never derived from N (Store needs the 4th field = 0).
// Usage: node kletron/tools/version.mjs [--json] [VERSION]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KLETRON_VERSION_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)-k\.([1-9]\d*)$/

export function parseKletronVersion(raw) {
  const m = KLETRON_VERSION_RE.exec(String(raw).trim())
  if (!m) throw new Error(`invalid Kletron version '${raw}' (expected X.Y.Z-k.N, N >= 1)`)
  const [x, y, z, n] = m.slice(1).map(Number)
  return { x, y, z, n, core: `${x}.${y}.${z}`, semver: `${x}.${y}.${z}-k.${n}`, pep440: `${x}.${y}.${z}+k.${n}`, tag: `v${x}.${y}.${z}-k.${n}` }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const arg = process.argv.slice(2).find(a => !a.startsWith('--'))
  const v = parseKletronVersion(arg ?? readFileSync(join(ROOT, 'kletron', 'VERSION'), 'utf8'))
  console.log(process.argv.includes('--json') ? JSON.stringify(v) : v.semver)
}
