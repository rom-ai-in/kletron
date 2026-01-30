import * as vscode from 'vscode'
import { ChatPanel } from '../panels/ChatPanel'
import { AgentRun } from '../tree/AgentTreeProvider'

type PanelFactory = () => ChatPanel

export function registerApplyDiffCommand(
  context: vscode.ExtensionContext,
  panelFactory: PanelFactory
) {
  const disposable = vscode.commands.registerCommand(
    'numezis.applyDiff',
    async (run?: AgentRun) => {
      const panel = panelFactory()
      await panel.requestApplyDiff(run?.runId)
    }
  )

  context.subscriptions.push(disposable)
}
