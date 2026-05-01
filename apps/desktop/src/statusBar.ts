// apps/desktop/src/statusBar.ts - Category status bar

import { Menu, nativeImage, Tray } from 'electron';
import * as path from 'path';

interface CategoryConfig {
    icon: string;
    color: string;
    tooltip: string;
}

/**
 * Category-aware status bar (menu bar icon)
 */
export class CategoryStatusBar {
    private tray: Tray | null;
    private currentCategory: string;
    private categoryConfigs: Record<string, CategoryConfig>;

    constructor() {
        this.tray = null;
        this.currentCategory = 'coding';
        this.categoryConfigs = {
            coding: {
                icon: path.join(__dirname, '../assets/icons/status-coding.png'),
                color: '#3B82F6',
                tooltip: 'Kletron - Coding Mode'
            },
            drafting: {
                icon: path.join(__dirname, '../assets/icons/status-drafting.png'),
                color: '#10B981',
                tooltip: 'Kletron - Document Drafting Mode'
            },
            automation: {
                icon: path.join(__dirname, '../assets/icons/status-automation.png'),
                color: '#F59E0B',
                tooltip: 'Kletron - Workflow Automation Mode'
            },
            general: {
                icon: path.join(__dirname, '../assets/icons/status-general.png'),
                color: '#6B7280',
                tooltip: 'Kletron'
            }
        };
    }

    /**
     * Initialize the status bar
     */
    initialize(): void {
        const config = this.getCategoryConfig(this.currentCategory);
        const icon = nativeImage.createFromPath(config.icon);

        this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
        this.tray.setToolTip(config.tooltip);

        this.tray.on('click', () => {
            this.showCategorySwitcher();
        });

        this.tray.on('right-click', () => {
            this.showContextMenu();
        });
    }

    /**
     * Update status bar for a category
     */
    updateForCategory(category: string): void {
        this.currentCategory = category;
        const config = this.getCategoryConfig(category);

        if (this.tray) {
            const icon = nativeImage.createFromPath(config.icon);
            this.tray.setImage(icon.resize({ width: 16, height: 16 }));
            this.tray.setToolTip(config.tooltip);
        }
    }

    /**
     * Show category switcher menu
     */
    showCategorySwitcher(): void {
        const template = [
            {
                label: 'Switch Category',
                submenu: [
                    {
                        label: '💻 Coding',
                        type: 'checkbox',
                        checked: this.currentCategory === 'coding',
                        click: () => this.emitCategoryChange('coding')
                    },
                    {
                        label: '✏️ Drafting',
                        type: 'checkbox',
                        checked: this.currentCategory === 'drafting',
                        click: () => this.emitCategoryChange('drafting')
                    },
                    {
                        label: '⚡ Automation',
                        type: 'checkbox',
                        checked: this.currentCategory === 'automation',
                        click: () => this.emitCategoryChange('automation')
                    },
                    { type: 'separator' },
                    {
                        label: '🎯 General',
                        type: 'checkbox',
                        checked: this.currentCategory === 'general',
                        click: () => this.emitCategoryChange('general')
                    }
                ]
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    require('electron').app.quit();
                }
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        if (this.tray) {
            this.tray.popUpContextMenu(menu);
        }
    }

    /**
     * Show context menu
     */
    private showContextMenu(): void {
        const template = [
            {
                label: 'Open Kletron',
                click: () => {
                    const { BrowserWindow } = require('electron');
                    const win = BrowserWindow.getAllWindows()[0];
                    if (win) {
                        if (win.isMinimized()) win.restore();
                        win.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: 'Switch Category',
                click: () => this.showCategorySwitcher()
            },
            { type: 'separator' },
            {
                label: 'Quit',
                click: () => {
                    require('electron').app.quit();
                }
            }
        ];

        const menu = Menu.buildFromTemplate(template);
        if (this.tray) {
            this.tray.popUpContextMenu(menu);
        }
    }

    /**
     * Emit category change event
     */
    private emitCategoryChange(category: string): void {
        this.currentCategory = category;
        this.updateForCategory(category);

        // Send to main window
        const { BrowserWindow } = require('electron');
        const windows = BrowserWindow.getAllWindows();
        windows.forEach(win => {
            win.webContents.send('kletron-category-changed', {
                category,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Get category config
     */
    private getCategoryConfig(category: string): CategoryConfig {
        return this.categoryConfigs[category] || this.categoryConfigs.general;
    }
}

// Singleton instance
export const categoryStatusBar = new CategoryStatusBar();
