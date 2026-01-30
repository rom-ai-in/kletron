import * as vscode from 'vscode'

export interface AgentRun {
  agentId: string
  prompt: string
  runId: string
  status: string
}

export class AgentTreeProvider implements vscode.TreeDataProvider<AgentTreeItem> {
  private runs: AgentRun[] = []
  private readonly emitter = new vscode.EventEmitter<AgentTreeItem | undefined>()
  readonly onDidChangeTreeData = this.emitter.event

  setRuns(runs: AgentRun[]) {
    this.runs = runs
    this.emitter.fire(undefined)
  }

  addRun(run: AgentRun) {
    this.runs = [run, ...this.runs.filter((existing) => existing.runId !== run.runId)]
    this.emitter.fire(undefined)
  }

  updateRunStatus(runId: string, status: string) {
    let updated = false
    this.runs = this.runs.map((run) => {
      if (run.runId === runId) {
        updated = true
        return { ...run, status }
      }
      return run
    })
    if (updated) {
      this.emitter.fire(undefined)
    }
  }

  getTreeItem(element: AgentTreeItem): vscode.TreeItem {
    return element
  }

  getChildren(element?: AgentTreeItem): vscode.ProviderResult<AgentTreeItem[]> {
    if (!this.runs.length) {
      return [
        new AgentTreeItem(
          {
            agentId: 'system',
            prompt: 'No agent runs yet (use Numezis: Open Chat)',
            runId: 'placeholder',
            status: 'idle',
          },
          { placeholder: true }
        ),
      ]
    }

    return this.runs.map((run) => new AgentTreeItem(run))
  }
}

class AgentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly run: AgentRun,
    private readonly options: { placeholder?: boolean } = {}
  ) {
    super(
      options.placeholder ? run.prompt : `${run.prompt} (${run.status})`,
      vscode.TreeItemCollapsibleState.None
    )

    this.description = options.placeholder ? undefined : run.runId
    this.tooltip = options.placeholder
      ? 'Submit a prompt via Numezis: Open Chat'
      : `Agent ${run.agentId} • Run ${run.runId}`
    this.contextValue = options.placeholder ? 'agentRunPlaceholder' : 'agentRun'

    if (!options.placeholder) {
      this.command = {
        command: 'numezis.openChat',
        title: 'Open chat',
        arguments: [run],
      }
    }
  }
}
