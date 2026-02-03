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
exports.registerAuthCommands = void 0;
const vscode = __importStar(require("vscode"));
function registerAuthCommands(context, backendClient, configuration, onAuthStateChanged) {
    // Login command - opens browser for OAuth flow
    const loginCommand = vscode.commands.registerCommand('numezis.login', async () => {
        var _a;
        const backendUrl = configuration.get('backendUrl', 'http://localhost:3000');
        // Open browser to login page with extension source
        const loginUrl = `${backendUrl}/auth/login?source=extension`;
        await vscode.env.openExternal(vscode.Uri.parse(loginUrl));
        // Prompt user to paste the token after login
        const token = await vscode.window.showInputBox({
            prompt: 'Paste your extension token from the browser',
            placeHolder: 'numezis_ext_...',
            password: true,
            ignoreFocusOut: true,
        });
        if (!token) {
            vscode.window.showWarningMessage('Login cancelled');
            return;
        }
        // Validate the token
        try {
            const res = await fetch(`${backendUrl}/api/auth/validate-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (!data.valid) {
                vscode.window.showErrorMessage(`Invalid token: ${data.error || 'Unknown error'}`);
                return;
            }
            // Save token to configuration
            await configuration.update('apiToken', token, vscode.ConfigurationTarget.Global);
            backendClient.setToken(token);
            // Notify about auth state change
            onAuthStateChanged({
                isAuthenticated: true,
                user: data.user,
                tokenLabel: data.tokenLabel,
            });
            vscode.window.showInformationMessage(`Signed in as ${((_a = data.user) === null || _a === void 0 ? void 0 : _a.email) || 'user'}`);
        }
        catch (err) {
            vscode.window.showErrorMessage(`Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
    });
    // Logout command
    const logoutCommand = vscode.commands.registerCommand('numezis.logout', async () => {
        const confirm = await vscode.window.showWarningMessage('Are you sure you want to sign out?', { modal: true }, 'Sign Out');
        if (confirm !== 'Sign Out') {
            return;
        }
        // Clear token
        await configuration.update('apiToken', '', vscode.ConfigurationTarget.Global);
        backendClient.setToken('');
        onAuthStateChanged({
            isAuthenticated: false,
        });
        vscode.window.showInformationMessage('Signed out of Numezis');
    });
    // Validate token command (useful for checking current auth state)
    const validateCommand = vscode.commands.registerCommand('numezis.validateToken', async () => {
        const token = configuration.get('apiToken', '');
        const backendUrl = configuration.get('backendUrl', 'http://localhost:3000');
        if (!token) {
            onAuthStateChanged({ isAuthenticated: false });
            return { valid: false };
        }
        try {
            const res = await fetch(`${backendUrl}/api/auth/validate-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();
            if (data.valid) {
                onAuthStateChanged({
                    isAuthenticated: true,
                    user: data.user,
                    tokenLabel: data.tokenLabel,
                });
            }
            else {
                onAuthStateChanged({ isAuthenticated: false });
            }
            return data;
        }
        catch {
            onAuthStateChanged({ isAuthenticated: false });
            return { valid: false };
        }
    });
    context.subscriptions.push(loginCommand, logoutCommand, validateCommand);
}
exports.registerAuthCommands = registerAuthCommands;
