import * as vscode from 'vscode'
import { BackendClient } from './utils/backendClient'
import { AgentTreeProvider } from './tree/AgentTreeProvider'
import { ChatPanel } from './panels/ChatPanel'
import { NumezisViewProvider } from './views/NumezisViewProvider'

export function activate(context: vscode.ExtensionContext) {
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

  const refreshStatusBar = () => {
    if (backendClient.hasBaseUrl()) {
      statusBar.text = `Numezis: connected`
      statusBar.tooltip = `Connected to ${backendClient.getBaseUrl()}`
    } else {
      statusBar.text = 'Numezis: disconnected'
      statusBar.tooltip = 'Connect to Numezis backend'
    }
    statusBar.command = undefined
  }

  refreshStatusBar()
  statusBar.show()
  context.subscriptions.push(statusBar)

  const storage = {
    getRuns: () => context.globalState.get('numezis.runs', []),
    setRuns: (runs: any[]) => {
      void context.globalState.update('numezis.runs', runs)
    },
    getMemory: () =>
      context.globalState.get('numezis.memory', {
        notes: '',
        rules: '',
        preferences: '',
      }),
    setMemory: (memory: any) => {
      void context.globalState.update('numezis.memory', memory)
    },
  }

  const persistedRuns = storage.getRuns()
  if (persistedRuns.length) {
    treeProvider.setRuns(
      persistedRuns.map((run: any) => ({
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
  // Intentionally left blank.
}
