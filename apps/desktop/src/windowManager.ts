// apps/desktop/src/windowManager.ts - Category-aware window management

import { BrowserWindow, nativeImage } from 'electron';
import * as path from 'path';

interface WindowOptions {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    title: string;
    icon: string;
}

interface WebPreferencesOptions {
    nodeIntegration: boolean;
    contextIsolation: boolean;
    sandbox: boolean;
    backgroundThrottling: boolean;
}

interface CategoryLayout {
    windowOptions: WindowOptions;
    webPreferences: WebPreferencesOptions;
}

/**
 * Category-aware window manager
 */
export class CategoryWindowManager {
    private windowStates: Map<string, { window: BrowserWindow; layout: CategoryLayout }>;
    private currentWindow: BrowserWindow | null;
    private currentCategory: string;
    private categoryLayouts: Record<string, CategoryLayout>;

    constructor() {
        this.windowStates = new Map();
        this.currentWindow = null;
        this.currentCategory = 'coding';
        this.categoryLayouts = this.loadCategoryLayouts();
    }

    /**
     * Create a window for a specific category
     */
    async createWindowForCategory(category: string): Promise<BrowserWindow> {
        const layout = this.categoryLayouts[category] || this.getDefaultLayout();

        const win = new BrowserWindow({
            width: layout.windowOptions.width,
            height: layout.windowOptions.height,
            minWidth: layout.windowOptions.minWidth,
            minHeight: layout.windowOptions.minHeight,
            title: layout.windowOptions.title,
            icon: nativeImage.createFromPath(layout.windowOptions.icon).resize({ width: 256, height: 256 }),
            webPreferences: {
                nodeIntegration: layout.webPreferences.nodeIntegration,
                contextIsolation: layout.webPreferences.contextIsolation,
                sandbox: layout.webPreferences.sandbox,
                backgroundThrottling: layout.webPreferences.backgroundThrottling,
                preload: path.join(__dirname, '../preload.js')
            }
        });

        // Load appropriate URL based on category
        const url = this.getCategoryURL(category);
        await win.loadURL(url);

        // Store window state
        this.windowStates.set(category, { window: win, layout });
        this.currentWindow = win;
        this.currentCategory = category;

        return win;
    }

    /**
     * Switch to a different category window
     */
    async switchCategory(newCategory: string, preserveWindow: boolean = true): Promise<BrowserWindow> {
        // Close current window if not preserving
        if (!preserveWindow && this.currentWindow) {
            this.currentWindow.close();
            this.currentWindow = null;
        }

        // Create or focus window for new category
        let win: BrowserWindow;
        if (this.windowStates.has(newCategory)) {
            const state = this.windowStates.get(newCategory)!;
            win = state.window;

            // Bring to front
            if (win.isMinimized()) win.restore();
            win.focus();
        } else {
            win = await this.createWindowForCategory(newCategory);
        }

        this.currentCategory = newCategory;
        return win;
    }

    /**
     * Get current category
     */
    getCurrentCategory(): string {
        return this.currentCategory;
    }

    /**
     * Get current window
     */
    getCurrentWindow(): BrowserWindow | null {
        return this.currentWindow;
    }

    /**
     * Get category URL
     */
    private getCategoryURL(category: string): string {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        return `${baseUrl}/app/${category}/workbench`;
    }

    /**
     * Load category layouts
     */
    private loadCategoryLayouts(): Record<string, CategoryLayout> {
        const iconsDir = path.join(__dirname, '../assets/icons');

        return {
            coding: {
                windowOptions: {
                    width: 1200,
                    height: 800,
                    minWidth: 900,
                    minHeight: 600,
                    title: 'Kletron - Coding',
                    icon: path.join(iconsDir, 'coding-icon.png')
                },
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
                    sandbox: false,
                    backgroundThrottling: false
                }
            },
            drafting: {
                windowOptions: {
                    width: 1000,
                    height: 700,
                    minWidth: 800,
                    minHeight: 500,
                    title: 'Kletron - Document Drafting',
                    icon: path.join(iconsDir, 'drafting-icon.png')
                },
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true,
                    backgroundThrottling: true
                }
            },
            automation: {
                windowOptions: {
                    width: 1100,
                    height: 750,
                    minWidth: 900,
                    minHeight: 600,
                    title: 'Kletron - Workflow Automation',
                    icon: path.join(iconsDir, 'automation-icon.png')
                },
                webPreferences: {
                    nodeIntegration: true,
                    contextIsolation: false,
                    sandbox: false,
                    backgroundThrottling: false
                }
            },
            general: {
                windowOptions: {
                    width: 1000,
                    height: 700,
                    minWidth: 800,
                    minHeight: 500,
                    title: 'Kletron',
                    icon: path.join(iconsDir, 'default-icon.png')
                },
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    sandbox: true,
                    backgroundThrottling: true
                }
            }
        };
    }

    /**
     * Get default layout
     */
    private getDefaultLayout(): CategoryLayout {
        return this.categoryLayouts.general || this.categoryLayouts.coding;
    }
}

// Singleton instance
export const categoryWindowManager = new CategoryWindowManager();
