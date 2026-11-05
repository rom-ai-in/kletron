// node --test kletron/tests/node — ordering of the Kletron version scheme with the REAL libraries.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseKletronVersion } from '../../tools/version.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const require = createRequire(join(ROOT, 'apps', 'desktop', 'package.json'))
const semver = require('semver')
const { AppUpdater } = require('electron-updater/out/AppUpdater')

const SEQ = ['0.22.7-k.1', '0.22.7-k.2', '0.22.7-k.9', '0.22.7-k.10', '0.22.8-k.1', '0.23.0-k.1', '1.0.0-k.1']

async function updaterSays(current, latest) {
  const self = { currentVersion: semver.parse(current), allowDowngrade: false,
    isUpdateSupported: () => true, isUserWithinRollout: () => true }
  return AppUpdater.prototype.isUpdateAvailable.call(self, { version: latest })
}

test('semver orders the sequence (numeric N, base bumps win)', () => {
  for (let i = 1; i < SEQ.length; i++) assert.ok(semver.gt(SEQ[i], SEQ[i - 1]), `${SEQ[i]} > ${SEQ[i - 1]}`)
  assert.deepEqual([...SEQ].reverse().sort(semver.compare), SEQ)
})

test('electron-updater offers every upgrade and no downgrade/same version', async () => {
  for (let i = 1; i < SEQ.length; i++) {
    assert.equal(await updaterSays(SEQ[i - 1], SEQ[i]), true, `${SEQ[i - 1]} -> ${SEQ[i]}`)
    assert.equal(await updaterSays(SEQ[i], SEQ[i - 1]), false, `no downgrade ${SEQ[i]} -> ${SEQ[i - 1]}`)
    assert.equal(await updaterSays(SEQ[i], SEQ[i]), false)
  }
})

test('documented trap: X.Y.Z-k.N sorts BELOW the plain upstream X.Y.Z', () => {
  // Never serve Kletron builds and upstream builds from the same feed (Kletron feed only, 0002).
  assert.ok(semver.lt('0.22.7-k.5', '0.22.7'))
})

test('PEP 440 form orders the same way (packaging)', () => {
  const py = join(ROOT, '.venv', 'bin', 'python')
  const forms = SEQ.map(v => parseKletronVersion(v).pep440)
  const out = execFileSync(py, ['-c', 'import sys,json;from packaging.version import Version as V;'
    + 'a=sys.argv[1:];print(json.dumps(sorted(reversed(a),key=V)==a and all(V(x).local for x in a)))', ...forms])
  assert.equal(out.toString().trim(), 'true')
})

test('MSIX quad: upstream time-based quad accepts vX.Y.Z and is monotonic by build time', async () => {
  const { nativeQuad } = await import(pathToFileURL(join(ROOT, 'scripts', 'msix-shared.mjs')).href)
  const { core } = parseKletronVersion('0.22.7-k.3')
  const q = t => nativeQuad(`v${core}`, t).split('.').map(Number)
  const a = q(Date.UTC(2026, 10, 5, 10) / 1000), b = q(Date.UTC(2026, 10, 5, 11) / 1000), c = q(Date.UTC(2027, 0, 1) / 1000)
  const cmp = (x, y) => x.findIndex((v, i) => v !== y[i])
  for (const [lo, hi] of [[a, b], [b, c]]) { const i = cmp(lo, hi); assert.ok(i >= 0 && hi[i] > lo[i]) }
  for (const p of [a, b, c]) { assert.equal(p.length, 4); assert.ok(p.every(n => n >= 0 && n <= 65535)); assert.equal(p[3], 0) }
  assert.throws(() => nativeQuad('v0.22.7-k.3', 0)) // upstream tooling rejects -k tags: Kletron passes vX.Y.Z
})

test('kletron/VERSION is valid', () => {
  const out = execFileSync(process.execPath, [join(ROOT, 'kletron', 'tools', 'version.mjs')]).toString().trim()
  assert.match(out, /^\d+\.\d+\.\d+-k\.[1-9]\d*$/)
  assert.throws(() => parseKletronVersion('0.22.7-k.0'))
  assert.throws(() => parseKletronVersion('0.22.7+k.1'))
})
