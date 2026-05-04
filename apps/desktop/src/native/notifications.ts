// apps/desktop/src/native/notifications.ts - Category-aware notifications

import { Notification, nativeImage } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface CategoryNotificationOptions {
    title: string;
    body: string;
    category: string;
    action?: {
        type: string;
        path?: string;
    };
    silent?: boolean;
}

interface CategoryConfig {
    defaultTitle: string;
    icon: string;
    sound: string;
}

/**
 * Category-aware notification center
 */
export class CategoryAwareNotifications {
    private notificationCenter: Map<string, Notification>;
    private categoryConfigs: Record<string, CategoryConfig>;

    constructor() {
        this.notificationCenter = new Map();
        this.categoryConfigs = {
            coding: {
                defaultTitle: 'Code Assistance',
                icon: path.join(__dirname, '../assets/icons/code-icon.png'),
                sound: 'default'
            },
            drafting: {
                defaultTitle: 'Document Ready',
                icon: path.join(__dirname, '../assets/icons/doc-icon.png'),
                sound: 'glass'
            },
            automation: {
                defaultTitle: 'Automation Update',
                icon: path.join(__dirname, '../assets/icons/automation-icon.png'),
                sound: 'hero'
            },
            general: {
                defaultTitle: 'Kletron',
                icon: path.join(__dirname, '../assets/icons/default-icon.png'),
                sound: 'default'
            }
        };
    }

    /**
     * Show a category-specific notification
     */
    showNotification(options: CategoryNotificationOptions): Notification {
        const config = this.getCategoryConfig(options.category);

        const notification = new Notification({
            title: options.title || config.defaultTitle,
            body: options.body,
            silent: options.silent !== false
        });

        // Handle category-specific actions
        if (options.action) {
            this.setupActionHandler(notification, options.action);
        }

        notification.show();
        this.notificationCenter.set(options.category, notification);

        return notification;
    }

    /**
     * Show a category-specific notification with progress
     */
    showProgressNotification(
        category: string,
        title: string,
        body: string,
        progress: number
    ): void {
        const notification = new Notification({
            title,
            body: `${body} (${Math.round(progress)}%)`,
            silent: true
        });

        notification.show();
    }

    /**
     * Clear all notifications for a category
     */
    clearNotifications(category?: string): void {
        if (category) {
            this.notificationCenter.delete(category);
        } else {
            this.notificationCenter.clear();
        }
    }

    /**
     * Setup action handler for notification click
     */
    private setupActionHandler(notification: Notification, action: { type: string; path?: string }): void {
        notification.on('click', () => {
            if (action.type === 'openFile' && action.path) {
                require('electron').shell.openPath(action.path);
            } else if (action.type === 'showInApp') {
                // Send to renderer
                const { BrowserWindow } = require('electron');
                const windows = BrowserWindow.getAllWindows();
                windows.forEach(win => {
                    win.webContents.send('kletron-notification', {
                        type: 'notificationClicked',
                        action,
                        timestamp: Date.now()
                    });
                });
            }
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
export const categoryNotifications = new CategoryAwareNotifications();
