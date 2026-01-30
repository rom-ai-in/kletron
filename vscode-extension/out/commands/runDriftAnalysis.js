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
exports.registerRunDriftAnalysisCommand = void 0;
const vscode = __importStar(require("vscode"));
function registerRunDriftAnalysisCommand(context, panelFactory) {
    const disposable = vscode.commands.registerCommand('numezis.runDriftAnalysis', async () => {
        const prompt = await vscode.window.showInputBox({
            prompt: 'Prompt for drift analysis',
            placeHolder: 'Describe the change you want the agent to make',
        });
        if (!prompt) {
            return;
        }
        const agentId = await vscode.window.showInputBox({
            prompt: 'Agent ID',
            value: 'agent-001',
        });
        const panel = panelFactory();
        await panel.runPrompt(prompt, agentId !== null && agentId !== void 0 ? agentId : 'agent-001');
    });
    context.subscriptions.push(disposable);
}
exports.registerRunDriftAnalysisCommand = registerRunDriftAnalysisCommand;
