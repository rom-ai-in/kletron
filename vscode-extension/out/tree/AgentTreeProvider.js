"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
class AgentTreeProvider {
    constructor() {
        this.runs = [];
        this.emitter = new vscode.EventEmitter();
        this.onDidChangeTreeData = this.emitter.event;
    }
    setRuns(runs) {
        this.runs = runs;
        this.emitter.fire(undefined);
    }
    addRun(run) {
        this.runs = [run, ...this.runs.filter((existing) => existing.runId !== run.runId)];
        this.emitter.fire(undefined);
    }
    updateRunStatus(runId, status) {
        let updated = false;
        this.runs = this.runs.map((run) => {
            if (run.runId === runId) {
                updated = true;
                return { ...run, status };
            }
            return run;
        });
        if (updated) {
            this.emitter.fire(undefined);
        }
    }
    getTreeItem(element) {
        return element;
    }
    getChildren(element) {
        if (!this.runs.length) {
            return [
                new AgentTreeItem({
                    agentId: 'system',
                    prompt: 'No agent runs yet (use Numezis: Open Chat)',
                    runId: 'placeholder',
                    status: 'idle',
                }, { placeholder: true }),
            ];
        }
        return this.runs.map((run) => new AgentTreeItem(run));
    }
}
exports.AgentTreeProvider = AgentTreeProvider;
class AgentTreeItem extends vscode.TreeItem {
    constructor(run, options = {}) {
        super(options.placeholder ? run.prompt : `${run.prompt} (${run.status})`, vscode.TreeItemCollapsibleState.None);
        this.run = run;
        this.options = options;
        this.description = options.placeholder ? undefined : run.runId;
        this.tooltip = options.placeholder
            ? 'Submit a prompt via Numezis: Open Chat'
            : `Agent ${run.agentId} • Run ${run.runId}`;
        this.contextValue = options.placeholder ? 'agentRunPlaceholder' : 'agentRun';
        if (!options.placeholder) {
            this.command = {
                command: 'numezis.openChat',
                title: 'Open chat',
                arguments: [run],
            };
        }
    }
}
