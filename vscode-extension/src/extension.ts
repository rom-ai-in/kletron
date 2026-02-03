import * as vscode from 'vscode'
import { BackendClient } from './utils/backendClient'
import { AgentTreeProvider } from './tree/AgentTreeProvider'
import { ChatPanel } from './panels/ChatPanel'
import { NumezisViewProvider } from './views/NumezisViewProvider'
import { registerAuthCommands, AuthState } from './commands/auth'

// Store context globally for static factory access
declare global {
  // eslint-disable-next-line no-var
  var numezisContext: vscode.ExtensionContext | undefined
}

export function activate(context: vscode.ExtensionContext) {
  // Store context for ChatPanel static factory
  globalThis.numezisContext = context

  const backendClient = new BackendClient()
  const treeProvider = new AgentTreeProvider()
  const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)

  const configuration = vscode.workspace.getConfiguration('numezis')
  const savedUrl = configuration.get<string>('backendUrl', '')
  const savedToken = configuration.get<string>('apiToken', '')
  if (savedUrl) {
    backendClient.setBaseUrl(savedUrl)
  }
  if (savedToken) {
    backendClient.setToken(savedToken)
  }

  let authState: AuthState = { isAuthenticated: false }

  const refreshStatusBar = () => {
    if (authState.isAuthenticated && authState.user) {
      statusBar.text = `$(account) ${authState.user.email}`
      statusBar.tooltip = `Signed in as ${authState.user.email}\n${authState.tokenLabel || 'VS Code Extension'}`
      statusBar.command = 'numezis.logout'
    } else if (backendClient.hasBaseUrl()) {
      statusBar.text = `$(plug) Numezis`
      statusBar.tooltip = `Connected to ${backendClient.getBaseUrl()} (not signed in)`
      statusBar.command = 'numezis.login'
    } else {
      statusBar.text = '$(plug) Numezis'
      statusBar.tooltip = 'Click to sign in'
      statusBar.command = 'numezis.login'
    }
  }

  refreshStatusBar()
  statusBar.show()
  context.subscriptions.push(statusBar)

  // Register auth commands
  registerAuthCommands(context, backendClient, configuration, (newState) => {
    authState = newState
    refreshStatusBar()
  })

  // Auto-validate token on startup
  if (savedToken) {
    vscode.commands.executeCommand('numezis.validateToken')
  }

  const storage = {
    getRuns: () => context.globalState.get('numezis.runs', []),
    setRuns: (runs: unknown[]) => {
      void context.globalState.update('numezis.runs', runs)
    },
  }

  const persistedRuns = storage.getRuns() as { agentId: string; prompt: string; runId: string; status: string }[]
  if (persistedRuns.length) {
    treeProvider.setRuns(
      persistedRuns.map((run) => ({
        agentId: run.agentId,
        prompt: run.prompt,
        runId: run.runId,
        status: run.status,
      }))
    )
  }

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      'numezis.chatView',
      new NumezisViewProvider(
        context.extensionUri,
        backendClient,
        treeProvider,
        () => {
          const latestConfig = vscode.workspace.getConfiguration('numezis')
          const url = latestConfig.get<string>('backendUrl', '')
          const token = latestConfig.get<string>('apiToken', '')
          if (url) {
            backendClient.setBaseUrl(url)
          }
          if (token) {
            backendClient.setToken(token)
          }
          refreshStatusBar()
        },
        storage
      )
    )
  )

  // All UX is now available directly inside the sidebar webview.
}

export function deactivate() {
  globalThis.numezisContext = undefined
}
