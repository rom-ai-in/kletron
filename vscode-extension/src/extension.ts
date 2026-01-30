import * as vscode from 'vscode'
import { BackendClient } from './utils/backendClient'
import { AgentTreeProvider } from './tree/AgentTreeProvider'
import { ChatPanel } from './panels/ChatPanel'
import { registerConnectBackendCommand } from './commands/connect'
import { registerOpenChatCommand } from './commands/openChat'
import { registerRunDriftAnalysisCommand } from './commands/runDriftAnalysis'
import { registerApplyDiffCommand } from './commands/applyDiff'

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
    statusBar.command = 'numezis.openChat'
  }

  refreshStatusBar()
  statusBar.show()
  context.subscriptions.push(statusBar)

  const persistedRuns = context.globalState.get<any[]>('numezis.runs', [])
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
    vscode.window.registerTreeDataProvider('agentTree', treeProvider)
  )

  registerConnectBackendCommand(
    context,
    backendClient,
    configuration,
    refreshStatusBar
  )

  const ensureChatPanel = () =>
    ChatPanel.createOrShow(
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
      {
        getRuns: () => context.globalState.get('numezis.runs', []),
        setRuns: (runs) => {
          void context.globalState.update('numezis.runs', runs)
        },
        getMemory: () =>
          context.globalState.get('numezis.memory', {
            notes: '',
            rules: '',
            preferences: '',
          }),
        setMemory: (memory) => {
          void context.globalState.update('numezis.memory', memory)
        },
      }
    )

  registerOpenChatCommand(context, ensureChatPanel)
  registerRunDriftAnalysisCommand(context, ensureChatPanel)
  registerApplyDiffCommand(context, ensureChatPanel)
}

export function deactivate() {
  // Intentionally left blank.
}
