/**
 * Kletron Validations — Desktop panel for pending approvals + managed policy.
 *
 * No numbered core patch (docs/06 D2 / planned/0005): bundled plugin discovered
 * via src/contrib/plugins.ts. Hard enforcement remains MCP gateway + OpenShell;
 * this UI surfaces the existing approval queue and Managed Scope YOLO lock.
 */
import {
  Codicon,
  type HermesPlugin,
  host,
  ROUTES_AREA,
  type RouteContribution,
  SIDEBAR_NAV_AREA,
  type SidebarNavContribution,
  STATUSBAR_AREAS,
  Tip,
  useValue
} from '@hermes/plugin-sdk'
import { useStore } from '@nanostores/react'
import { useMemo, type ReactNode } from 'react'

import {
  answerApproval,
  type ApprovalRequest,
  sessionApprovalRequests
} from '@/store/prompts'

function usePending(): ApprovalRequest[] {
  const sessionId = useValue(host.state.activeSessionId)
  const store = useMemo(() => sessionApprovalRequests(sessionId), [sessionId])
  return useStore(store)
}

function ValidationsPage(): ReactNode {
  const pending = usePending()
  const gateway = useValue(host.state.gateway)

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4 text-sm">
      <header className="flex flex-col gap-1">
        <h1 className="text-base font-semibold">Validations</h1>
        <p className="text-(--ui-text-tertiary) text-xs">
          Pending tool approvals for the active session. Managed Scope can pin{' '}
          <code>kletron.forbid_yolo</code> and <code>approvals.mode</code>. The MCP
          gateway remains the hard enforcement boundary.
        </p>
        <p className="text-(--ui-text-tertiary) text-xs">Gateway: {String(gateway)}</p>
      </header>

      {pending.length === 0 ? (
        <p className="text-(--ui-text-tertiary)">No pending validations.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pending.map(req => (
            <li
              key={req.requestId ?? `${req.sessionId}-${req.command}`}
              className="border-border flex flex-col gap-2 rounded border p-3"
            >
              <div className="font-medium">{req.description || 'Approval required'}</div>
              <pre className="bg-muted/40 max-h-40 overflow-auto rounded p-2 text-[0.75rem] whitespace-pre-wrap">
                {req.command}
              </pre>
              <div className="flex flex-wrap gap-2">
                {(req.choices?.length ? req.choices : ['once', 'session', 'always', 'deny']).map(choice => (
                  <button
                    key={choice}
                    type="button"
                    className="border-border hover:bg-muted/50 rounded border px-2 py-1 text-xs capitalize"
                    onClick={() => {
                      const gw = host.getGateway?.() ?? null
                      void answerApproval(gw, req, choice)
                    }}
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ValidationsChip(): ReactNode {
  const pending = usePending()
  const n = pending.length
  if (n === 0) return null
  return (
    <Tip label={`${n} validation(s) pending — open Validations`}>
      <button
        type="button"
        className="inline-flex h-full items-center gap-1 px-1.5 text-[0.6875rem] text-(--ui-text-tertiary)"
        onClick={() => host.navigate('/validations')}
      >
        <Codicon name="shield" />
        {n}
      </button>
    </Tip>
  )
}

const plugin: HermesPlugin = {
  id: 'kletron-validations',
  name: 'Kletron Validations',
  description: 'Pending approvals panel and Managed Scope policy surfacing.',
  defaultEnabled: true,
  register(ctx) {
    ctx.registerMany([
      {
        id: 'page',
        area: ROUTES_AREA,
        data: { path: '/validations' } satisfies RouteContribution,
        render: () => <ValidationsPage />
      },
      {
        id: 'nav',
        area: SIDEBAR_NAV_AREA,
        order: 45,
        data: { codicon: 'shield', label: 'Validations', path: '/validations' } satisfies SidebarNavContribution
      },
      {
        id: 'chip',
        area: STATUSBAR_AREAS.right,
        order: 40,
        render: () => <ValidationsChip />
      }
    ])

    ctx.registerSettingsPage?.({
      id: 'policy',
      title: 'Kletron policy',
      icon: 'shield',
      render: () => (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            YOLO bypass is controlled by Managed Scope key <code>kletron.forbid_yolo</code>{' '}
            (Linux v1: <code>/etc/hermes</code>).
          </p>
          <p>
            Third-party validators load via <code>plugins.enabled</code>. Absence of the
            validator is fail-open at the agent hook layer — rely on the MCP gateway +
            OpenShell for hard enforcement.
          </p>
        </div>
      )
    })
  }
}

export default plugin
