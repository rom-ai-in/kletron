import * as vscode from 'vscode'
import { ChatPanel } from '../panels/ChatPanel'

type PanelFactory = () => ChatPanel

export function registerOpenChatCommand(
  context: vscode.ExtensionContext,
  panelFactory: PanelFactory
) {
  const disposable = vscode.commands.registerCommand('numezis.openChat', () => {
    panelFactory()
  })
  context.subscriptions.push(disposable)
}
