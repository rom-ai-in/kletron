import * as vscode from 'vscode'
import { BackendClient } from '../utils/backendClient'

export function registerConnectBackendCommand(
  context: vscode.ExtensionContext,
  backendClient: BackendClient,
  configuration: vscode.WorkspaceConfiguration,
  refresh: () => void
) {
  const disposable = vscode.commands.registerCommand('numezis.connectBackend', async () => {
    const url = await vscode.window.showInputBox({
      prompt: 'Backend URL',
      value: configuration.get<string>('backendUrl', ''),
    })
    if (!url) {
      return
    }

    const token = await vscode.window.showInputBox({
      prompt: 'API token (optional)',
      value: configuration.get<string>('apiToken', ''),
    })

    backendClient.setBaseUrl(url)
    await configuration.update('backendUrl', url, vscode.ConfigurationTarget.Global)

    if (token !== undefined) {
      backendClient.setToken(token)
      await configuration.update('apiToken', token, vscode.ConfigurationTarget.Global)
    }

    refresh()
    vscode.window.showInformationMessage(`Connected to ${url}`)
  })

  context.subscriptions.push(disposable)
}
