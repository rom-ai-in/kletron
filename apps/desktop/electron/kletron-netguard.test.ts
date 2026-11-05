import dns from 'node:dns'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  app: { commandLine: { appendSwitch: vi.fn() }, whenReady: vi.fn(() => new Promise(() => {})) },
  session: { defaultSession: { webRequest: { onBeforeRequest: vi.fn() } } }
}))

vi.mock('electron', () => electron)

test('Kletron netguard blocks every upstream Nous host at each layer', async () => {
  const ng = await import('./kletron-netguard')

  const [name, rules] = electron.app.commandLine.appendSwitch.mock.calls[0]
  expect(name).toBe('host-resolver-rules')
  expect(rules).toContain('MAP *.nousresearch.com ~NOTFOUND')

  for (const h of ['portal.nousresearch.com', 'NOUSRESEARCH.COM.', 'hermes-agent.nousresearch.com', 'nousresearch.github.io']) {
    expect(ng.isKletronBlockedHost(h)).toBe(true)
  }

  for (const h of ['github.com', 'example.com', 'notnousresearch.com', '127.0.0.1']) {
    expect(ng.isKletronBlockedHost(h)).toBe(false)
  }

  expect(ng.isKletronBlockedUrl('https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh')).toBe(true)
  expect(ng.isKletronBlockedUrl('https://api.github.com/repos/NousResearch/hermes-agent/releases')).toBe(true)
  expect(ng.isKletronBlockedUrl('https://github.com/kletron/kletron-agent')).toBe(false)

  const err = await new Promise<NodeJS.ErrnoException | null>(resolve => dns.lookup('portal.nousresearch.com', e => resolve(e)))
  expect(err?.code).toBe('ENOTFOUND')
  await expect(dns.promises.lookup('telemetry.nousresearch.com')).rejects.toMatchObject({ code: 'ENOTFOUND' })
  await expect(fetch('https://portal.nousresearch.com/')).rejects.toThrow()
})

test('main.ts installs the netguard before anything else', () => {
  const first = readFileSync(join(__dirname, 'main.ts'), 'utf8').split('\n')[0]
  expect(first).toMatch(/^import '\.\/kletron-netguard'/)
})

test('the remote installer never falls back to the upstream repository', () => {
  const src = readFileSync(join(__dirname, 'bootstrap-runner.ts'), 'utf8')
  expect(src).not.toMatch(/NousResearch\/hermes-agent\/\$\{ref\}/)
  expect(src).toContain('KLETRON_INSTALL_SOURCE')
})

test('electron-builder publishes no update feed by default and never to NousResearch', async () => {
  const saved = { ...process.env }
  delete process.env.KLETRON_UPDATE_URL
  delete process.env.CLOUDFLARE_R2_PUBLIC_URL
  process.env.GITHUB_REPOSITORY = 'NousResearch/hermes-agent'

  try {
    const path = require.resolve('../electron-builder.config.cjs')
    delete require.cache[path]
    const config = require(path)
    expect(config.publish).toBeNull()
    expect(config.mac.publish).toBeNull()
    expect(config.appId).toBe('ch.numezis.kletron')
    expect(JSON.stringify([config.publish, config.mac.publish, config.appId, config.extraMetadata])).not.toMatch(/nous/i)
  } finally {
    process.env = saved
  }
})
