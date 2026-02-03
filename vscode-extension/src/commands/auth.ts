import * as vscode from 'vscode'
import { BackendClient } from '../utils/backendClient'

export interface AuthState {
    isAuthenticated: boolean
    user?: {
        id: string
        email: string
        name: string | null
    }
    tokenLabel?: string
}

export function registerAuthCommands(
    context: vscode.ExtensionContext,
    backendClient: BackendClient,
    configuration: vscode.WorkspaceConfiguration,
    onAuthStateChanged: (state: AuthState) => void
) {
    // Login command - opens browser for OAuth flow
    const loginCommand = vscode.commands.registerCommand('numezis.login', async () => {
        const backendUrl = configuration.get<string>('backendUrl', 'http://localhost:3000')

        // Open browser to login page with extension source
        const loginUrl = `${backendUrl}/auth/login?source=extension`
        await vscode.env.openExternal(vscode.Uri.parse(loginUrl))

        // Prompt user to paste the token after login
        const token = await vscode.window.showInputBox({
            prompt: 'Paste your extension token from the browser',
            placeHolder: 'numezis_ext_...',
            password: true,
            ignoreFocusOut: true,
        })

        if (!token) {
            vscode.window.showWarningMessage('Login cancelled')
            return
        }

        // Validate the token
        try {
            const res = await fetch(`${backendUrl}/api/auth/validate-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })

            const data = await res.json() as { valid: boolean; user?: any; tokenLabel?: string; error?: string }

            if (!data.valid) {
                vscode.window.showErrorMessage(`Invalid token: ${data.error || 'Unknown error'}`)
                return
            }

            // Save token to configuration
            await configuration.update('apiToken', token, vscode.ConfigurationTarget.Global)
            backendClient.setToken(token)

            // Notify about auth state change
            onAuthStateChanged({
                isAuthenticated: true,
                user: data.user,
                tokenLabel: data.tokenLabel,
            })

            vscode.window.showInformationMessage(`Signed in as ${data.user?.email || 'user'}`)
        } catch (err) {
            vscode.window.showErrorMessage(`Login failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
        }
    })

    // Logout command
    const logoutCommand = vscode.commands.registerCommand('numezis.logout', async () => {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to sign out?',
            { modal: true },
            'Sign Out'
        )

        if (confirm !== 'Sign Out') {
            return
        }

        // Clear token
        await configuration.update('apiToken', '', vscode.ConfigurationTarget.Global)
        backendClient.setToken('')

        onAuthStateChanged({
            isAuthenticated: false,
        })

        vscode.window.showInformationMessage('Signed out of Numezis')
    })

    // Validate token command (useful for checking current auth state)
    const validateCommand = vscode.commands.registerCommand('numezis.validateToken', async () => {
        const token = configuration.get<string>('apiToken', '')
        const backendUrl = configuration.get<string>('backendUrl', 'http://localhost:3000')

        if (!token) {
            onAuthStateChanged({ isAuthenticated: false })
            return { valid: false }
        }

        try {
            const res = await fetch(`${backendUrl}/api/auth/validate-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token }),
            })

            const data = await res.json() as { valid: boolean; user?: any; tokenLabel?: string }

            if (data.valid) {
                onAuthStateChanged({
                    isAuthenticated: true,
                    user: data.user,
                    tokenLabel: data.tokenLabel,
                })
            } else {
                onAuthStateChanged({ isAuthenticated: false })
            }

            return data
        } catch {
            onAuthStateChanged({ isAuthenticated: false })
            return { valid: false }
        }
    })

    context.subscriptions.push(loginCommand, logoutCommand, validateCommand)
}
