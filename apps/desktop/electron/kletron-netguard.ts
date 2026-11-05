// Kletron: Nous Research hosts do not resolve inside the desktop app (defense in depth;
// the real neutralization is at the source: no publish feed, no remote installer).
// No upstream code is patched. Layers, all official or resolver-level:
//   - Chromium (renderer, net.fetch, electron-updater): `host-resolver-rules` switch;
//   - Chromium path rule (github.com/NousResearch/*): session.webRequest on the default session;
//   - Node resolver of the main process (fetch/undici, https): dns.lookup -> ENOTFOUND,
//     i.e. the "offline" path every caller already handles.
// Links the user opens in their own browser (docs) are out of scope on purpose.
// Must be imported first in main.ts: the switch only applies before `ready`.
import dns from 'node:dns'

import { app, session } from 'electron'

export const KLETRON_BLOCKED_DOMAINS: readonly string[] = ['nousresearch.com', 'nousresearch.github.io', 'nous.dev']

/** GitHub paths of the upstream org (install scripts, releases, API). */
const BLOCKED_GITHUB = /^https?:\/\/(?:[^/]+\.)?(?:github\.com|githubusercontent\.com)\/(?:repos\/)?nousresearch(?:\/|$)/i

export function isKletronBlockedHost(host: string): boolean {
  const h = String(host || '')
    .trim()
    .replace(/\.$/, '')
    .toLowerCase()

  return KLETRON_BLOCKED_DOMAINS.some(d => h === d || h.endsWith(`.${d}`))
}

export function isKletronBlockedUrl(raw: string): boolean {
  try {
    const url = new URL(raw)

    return isKletronBlockedHost(url.hostname) || BLOCKED_GITHUB.test(url.href)
  } catch {
    return false
  }
}

function notFound(host: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(`getaddrinfo ENOTFOUND ${host} (blocked by Kletron netguard)`)
  err.code = 'ENOTFOUND'

  return err
}

let installed = false

export function installKletronNetguard(): void {
  if (installed) {
    return
  }

  installed = true

  const rules = KLETRON_BLOCKED_DOMAINS.flatMap(d => [`MAP ${d} ~NOTFOUND`, `MAP *.${d} ~NOTFOUND`]).join(', ')

  app.commandLine.appendSwitch('host-resolver-rules', rules)

  const lookup = dns.lookup as (...args: unknown[]) => unknown

  dns.lookup = ((hostname: string, ...rest: unknown[]) => {
    const cb = rest[rest.length - 1]

    if (isKletronBlockedHost(hostname) && typeof cb === 'function') {
      process.nextTick(() => cb(notFound(hostname)))

      return undefined
    }

    return lookup.call(dns, hostname, ...rest)
  }) as typeof dns.lookup

  const promisesLookup = dns.promises.lookup.bind(dns.promises) as (...args: unknown[]) => unknown

  dns.promises.lookup = (async (hostname: string, ...rest: unknown[]) => {
    if (isKletronBlockedHost(hostname)) {
      throw notFound(hostname)
    }

    return promisesLookup(hostname, ...rest)
  }) as typeof dns.promises.lookup

  const filter = { urls: ['*://github.com/*', '*://*.github.com/*', '*://*.githubusercontent.com/*'] }

  void app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
      callback({ cancel: isKletronBlockedUrl(details.url) })
    })
  })
}

installKletronNetguard()
