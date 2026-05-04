// apps/desktop/src/protocol.ts - Deep linking handlers

interface DeepLinkResult {
    type: string;
    [key: string]: unknown;
}

interface ProtocolHandler {
    (url: string): DeepLinkResult | null;
}

/**
 * Category-specific protocol handlers
 */
const categoryHandlers: Record<string, Record<string, ProtocolHandler>> = {
    coding: {
        vscode: (url: string): DeepLinkResult | null => {
            const match = url.match(/^vscode:\/\/(file|extension|workspace)\/(.*)$/);
            if (match) {
                return {
                    type: 'vscode',
                    action: match[1],
                    path: decodeURIComponent(match[2])
                };
            }
            return null;
        },
        git: (url: string): DeepLinkResult | null => {
            const match = url.match(/^git:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/);
            if (match) {
                return {
                    type: 'git',
                    owner: match[1],
                    repo: match[2]
                };
            }
            return null;
        },
        github: (url: string): DeepLinkResult | null => {
            const match = url.match(/^github:\/\/(pull|issue|commit)\/([^\/]+)\/([^\/]+)\/(.+)$/);
            if (match) {
                return {
                    type: 'github',
                    action: match[1],
                    owner: match[2],
                    repo: match[3],
                    id: match[4]
                };
            }
            return null;
        }
    },
    drafting: {
        pages: (url: string): DeepLinkResult | null => {
            const match = url.match(/^pages:\/\/(.*)$/);
            if (match) {
                return {
                    type: 'pages',
                    path: decodeURIComponent(match[1])
                };
            }
            return null;
        },
        preview: (url: string): DeepLinkResult | null => {
            const match = url.match(/^preview:\/\/(.*)$/);
            if (match) {
                return {
                    type: 'preview',
                    path: decodeURIComponent(match[1])
                };
            }
            return null;
        }
    },
    automation: {
        calendar: (url: string): DeepLinkResult | null => {
            const match = url.match(/^webcal:\/\/calendar\?(.*)$/);
            if (match) {
                return {
                    type: 'calendar',
                    query: decodeURIComponent(match[1])
                };
            }
            return null;
        },
        reminder: (url: string): DeepLinkResult | null => {
            const match = url.match(/^x-apple-reminder:\/\/(.*)$/);
            if (match) {
                return {
                    type: 'reminder',
                    id: decodeURIComponent(match[1])
                };
            }
            return null;
        }
    }
};

/**
 * Handle a deep link with category awareness
 */
export function handleDeepLink(url: string, category: string): DeepLinkResult | null {
    // Try category-specific handlers first
    const categoryHandler = categoryHandlers[category];
    if (categoryHandler) {
        for (const [protocol, handlerFunc] of Object.entries(categoryHandler)) {
            if (url.startsWith(protocol + '://')) {
                const result = handlerFunc(url);
                if (result) return result;
            }
        }
    }

    // Fall back to general handlers
    return handleGeneralDeepLink(url);
}

/**
 * Handle general deep links
 */
function handleGeneralDeepLink(url: string): DeepLinkResult | null {
    // Handle http/https links
    if (url.startsWith('http://') || url.startsWith('https://')) {
        const parsed = new URL(url);
        if (parsed.hostname === 'kletron.com') {
            return {
                type: 'kletron',
                path: parsed.pathname,
                query: Object.fromEntries(parsed.searchParams.entries())
            };
        }
    }

    // Handle file links
    if (url.startsWith('file://')) {
        return {
            type: 'file',
            path: decodeURIComponent(url.replace('file://', ''))
        };
    }

    return null;
}

/**
 * Register deep link handler
 */
export function registerDeepLinkHandler(app: Electron.App): void {
    app.on('open-url', (event, url) => {
        event.preventDefault();

        // Determine category from URL
        let category = 'general';
        if (url.includes('coding')) category = 'coding';
        else if (url.includes('drafting')) category = 'drafting';
        else if (url.includes('automation')) category = 'automation';

        const result = handleDeepLink(url, category);
        if (result) {
            // Send to main window
            const { BrowserWindow } = require('electron');
            const windows = BrowserWindow.getAllWindows();
            windows.forEach(win => {
                win.webContents.send('kletron-deep-link', {
                    result,
                    category,
                    timestamp: Date.now()
                });
            });
        }
    });
}
