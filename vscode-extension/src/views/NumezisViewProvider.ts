import * as vscode from 'vscode'
import { BackendClient } from '../utils/backendClient'
import { AgentTreeProvider } from '../tree/AgentTreeProvider'
import { ChatPanel } from '../panels/ChatPanel'

export class NumezisViewProvider implements vscode.WebviewViewProvider {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly backendClient: BackendClient,
    private readonly treeProvider: AgentTreeProvider,
    private readonly onSettingsUpdated: () => void,
    private readonly storage: {
      getRuns: () => any[]
      setRuns: (runs: any[]) => void
      getMemory: () => any
      setMemory: (memory: any) => void
    }
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView) {
    webviewView.webview.options = {
      enableScripts: true,
    }
    webviewView.title = 'Studio'
    webviewView.description = 'Numezis'
    ChatPanel.createForView(
      webviewView,
      this.extensionUri,
      this.backendClient,
      this.treeProvider,
      this.onSettingsUpdated,
      this.storage
    )
  }
}
