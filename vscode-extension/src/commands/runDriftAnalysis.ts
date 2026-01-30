import * as vscode from 'vscode'
import { ChatPanel } from '../panels/ChatPanel'

type PanelFactory = () => ChatPanel

export function registerRunDriftAnalysisCommand(
  context: vscode.ExtensionContext,
  panelFactory: PanelFactory
) {
  const disposable = vscode.commands.registerCommand('numezis.runDriftAnalysis', async () => {
    const prompt = await vscode.window.showInputBox({
      prompt: 'Prompt for drift analysis',
      placeHolder: 'Describe the change you want the agent to make',
    })
    if (!prompt) {
      return
    }

    const agentId = await vscode.window.showInputBox({
      prompt: 'Agent ID',
      value: 'agent-001',
    })

    const panel = panelFactory()
    await panel.runPrompt(prompt, agentId ?? 'agent-001')
  })

  context.subscriptions.push(disposable)
}
