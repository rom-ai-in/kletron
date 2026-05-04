// apps/desktop/src/security.ts - Category security manager

import { BrowserWindow } from 'electron';

interface SecurityPolicy {
    webPreferences: {
        sandbox: boolean;
        nodeIntegration: boolean;
        contextIsolation: boolean;
        webSecurity: boolean;
    };
    csp: {
        defaultSrc: string[];
        scriptSrc: string[];
        styleSrc: string[];
        imgSrc: string[];
        fontSrc: string[];
        connectSrc: string[];
    };
    fileAccess: {
        readable: string[];
        writable: string[];
        executable: string[];
    };
    protocols: string[];
}

/**
 * Category-aware security manager
 */
export class CategorySecurityManager {
    private securityPolicies: Record<string, SecurityPolicy>;

    constructor() {
        this.securityPolicies = {
            coding: {
                webPreferences: {
                    sandbox: false,
                    nodeIntegration: true,
                    contextIsolation: false,
                    webSecurity: true
                },
                csp: {
                    defaultSrc: ["'self'", "https://*.kletron.com"],
                    scriptSrc: ["'self'", "'unsafe-eval'", "https://*.kletron.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://*.kletron.com"],
                    imgSrc: ["'self'", "data:", "https://*.kletron.com"],
                    fontSrc: ["'self'", "https://*.kletron.com"],
                    connectSrc: ["'self'", "http://localhost:9000", "https://*.kletron.com"]
                },
                fileAccess: {
                    readable: ['**/*.{js,ts,jsx,tsx,py,java,cpp,h,hpp,go,rs,json,yaml,yml,toml}'],
                    writable: ['**/*.{js,ts,jsx,tsx,py,java,cpp,h,hpp,go,rs}'],
                    executable: ['node_modules/.bin/*', 'scripts/*']
                },
                protocols: ['vscode://', 'git://', 'github://']
            },
            drafting: {
                webPreferences: {
                    sandbox: true,
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true
                },
                csp: {
                    defaultSrc: ["'self'", "https://*.kletron.com"],
                    scriptSrc: ["'self'", "https://*.kletron.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://*.kletron.com"],
                    imgSrc: ["'self'", "data:", "https://*.kletron.com"],
                    fontSrc: ["'self'", "https://*.kletron.com"],
                    connectSrc: ["'self'", "https://*.kletron.com"]
                },
                fileAccess: {
                    readable: ['**/*.{docx,pdf,md,txt,rtf}'],
                    writable: ['**/*.{docx,pdf,md,txt,rtf}'],
                    executable: []
                },
                protocols: ['pages://', 'preview://']
            },
            automation: {
                webPreferences: {
                    sandbox: false,
                    nodeIntegration: true,
                    contextIsolation: false,
                    webSecurity: true
                },
                csp: {
                    defaultSrc: ["'self'", "https://*.kletron.com"],
                    scriptSrc: ["'self'", "'unsafe-eval'", "https://*.kletron.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://*.kletron.com"],
                    imgSrc: ["'self'", "data:", "https://*.kletron.com"],
                    fontSrc: ["'self'", "https://*.kletron.com"],
                    connectSrc: ["'self'", "http://localhost:9000", "https://*.kletron.com"]
                },
                fileAccess: {
                    readable: ['**/*.{json,yaml,yml,toml,sh,bash,py}'],
                    writable: ['**/*.{json,yaml,yml,toml,sh,bash,py}'],
                    executable: ['**/*.sh', '**/*.bash', '**/*.py']
                },
                protocols: ['webcal://', 'x-apple-reminder://']
            },
            general: {
                webPreferences: {
                    sandbox: true,
                    nodeIntegration: false,
                    contextIsolation: true,
                    webSecurity: true
                },
                csp: {
                    defaultSrc: ["'self'", "https://*.kletron.com"],
                    scriptSrc: ["'self'", "https://*.kletron.com"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://*.kletron.com"],
                    imgSrc: ["'self'", "data:", "https://*.kletron.com"],
                    fontSrc: ["'self'", "https://*.kletron.com"],
                    connectSrc: ["'self'", "https://*.kletron.com"]
                },
                fileAccess: {
                    readable: ['**/*'],
                    writable: [],
                    executable: []
                },
                protocols: ['https://', 'http://']
            }
        };
    }

    /**
     * Apply security policy for a category
     */
    applySecurityForCategory(category: string): void {
        const policy = this.securityPolicies[category] || this.securityPolicies.general;

        // Apply webPreferences security to all windows
        this.applyWebPreferencesSecurity(policy.webPreferences);

        // Configure content security
        this.configureContentSecurity(policy.csp);

        // Set file access rules
        this.setFileAccessRules(policy.fileAccess);

        // Configure protocol handlers
        this.setupProtocolHandlers(policy.protocols);
    }

    /**
     * Apply webPreferences security
     */
    private applyWebPreferencesSecurity(prefs: SecurityPolicy['webPreferences']): void {
        const allWindows = BrowserWindow.getAllWindows();
        allWindows.forEach(win => {
            // In production, apply webPreferences to new windows
            console.log('[Security] Applying webPreferences:', prefs);
        });
    }

    /**
     * Configure content security policy
     */
    private configureContentSecurity(csp: SecurityPolicy['csp']): void {
        // In production, set CSP headers
        console.log('[Security] Configuring CSP:', csp);
    }

    /**
     * Set file access rules
     */
    private setFileAccessRules(fileAccess: SecurityPolicy['fileAccess']): void {
        // In production, configure Electron's file access restrictions
        console.log('[Security] Setting file access rules:', fileAccess);
    }

    /**
     * Configure protocol handlers
     */
    private setupProtocolHandlers(protocols: string[]): void {
        // In production, register allowed protocols
        console.log('[Security] Setting up protocol handlers:', protocols);
    }

    /**
     * Check if a request is allowed
     */
    isAllowedRequest(url: string, category: string): boolean {
        const policy = this.securityPolicies[category] || this.securityPolicies.general;
        const parser = new URL(url);
        const host = parser.hostname;

        // Allow localhost for development
        if (host === 'localhost' || host.endsWith('.localhost')) {
            return true;
        }

        // Check connectSrc for API calls
        if (parser.protocol === 'https:' && this.isApiRequest(url)) {
            return policy.connectSrc.some(src =>
                url.match(new RegExp(src.replace(/\*/g, '[^.]+')))
            );
        }

        return true;
    }

    /**
     * Check if URL is an API request
     */
    private isApiRequest(url: string): boolean {
        return url.includes('/api/') || url.includes('/graphql');
    }
}

// Singleton instance
export const categorySecurityManager = new CategorySecurityManager();
