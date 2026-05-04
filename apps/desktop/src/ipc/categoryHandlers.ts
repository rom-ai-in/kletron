// apps/desktop/src/ipc/mainProcess.ts - Category-specific handlers

import { ipcMain, shell, dialog, Notification } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

interface CategoryAction {
    action: string;
    category: string;
    [key: string]: unknown;
}

/**
 * Category-specific native handlers
 */
const categorySpecificHandlers: Record<string, Record<string, (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>>> = {
    coding: {
        openInVSCode: async (event: Electron.IpcMainInvokeEvent, filePath: string) => {
            try {
                await shell.openExternal(`vscode://file/${filePath}`);
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
        showGitStatus: async (event: Electron.IpcMainInvokeEvent) => {
            try {
                // In production, use git command
                return { success: true, status: 'git status output' };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
        selectWorkspace: async (event: Electron.IpcMainInvokeEvent) => {
            try {
                const { cancelled, filePaths } = await dialog.showOpenDialog({
                    title: 'Select Code Workspace',
                    properties: ['openDirectory'],
                    filters: [
                        { name: 'Code Files', extensions: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'h', 'hpp', 'go', 'rs'] }
                    ]
                });

                if (cancelled || filePaths.length === 0) {
                    return { cancelled: true };
                }

                return { cancelled: false, path: filePaths[0] };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        }
    },
    drafting: {
        openInPages: async (event: Electron.IpcMainInvokeEvent, filePath: string) => {
            try {
                await shell.openExternal(`pages://${filePath}`);
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
        printDocument: async (event: Electron.IpcMainInvokeEvent, options: { filePath: string; [key: string]: unknown }) => {
            try {
                // In production, use print service
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
        selectFiles: async (event: Electron.IpcMainInvokeEvent) => {
            try {
                const { cancelled, filePaths } = await dialog.showOpenDialog({
                    title: 'Select Documents',
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Documents', extensions: ['docx', 'pdf', 'md', 'txt', 'rtf'] },
                        { name: 'All Files', extensions: ['*'] }
                    ]
                });

                if (cancelled) {
                    return { cancelled: true };
                }

                return { cancelled: false, paths: filePaths };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        }
    },
    automation: {
        scheduleNotification: async (event: Electron.IpcMainInvokeEvent, options: { title: string; body: string; timestamp?: number }) => {
            try {
                const notification = new Notification({
                    title: options.title,
                    body: options.body
                });

                if (options.timestamp) {
                    setTimeout(() => {
                        notification.show();
                    }, options.timestamp - Date.now());
                } else {
                    notification.show();
                }

                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
        openCalendarEvent: async (event: Electron.IpcMainInvokeEvent, eventId: string) => {
            try {
                await shell.openExternal(`webcal://calendar?event=${encodeURIComponent(eventId)}`);
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
        selectFiles: async (event: Electron.IpcMainInvokeEvent) => {
            try {
                const { cancelled, filePaths } = await dialog.showOpenDialog({
                    title: 'Select Configuration Files',
                    properties: ['openFile', 'multiSelections'],
                    filters: [
                        { name: 'Config Files', extensions: ['json', 'yaml', 'yml', 'toml'] },
                        { name: 'Script Files', extensions: ['sh', 'bash', 'py', 'js'] }
                    ]
                });

                if (cancelled) {
                    return { cancelled: true };
                }

                return { cancelled: false, paths: filePaths };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        }
    }
};

/**
 * Register category-specific IPC handlers
 */
export function registerCategoryHandlers(): void {
    ipcMain.handle('kletron.categoryAction', async (event: Electron.IpcMainInvokeEvent, action: CategoryAction) => {
        const { action: actionName, category, ...args } = action;

        if (!categorySpecificHandlers[category]?.[actionName]) {
            throw new Error(`Action ${actionName} not supported for category ${category}`);
        }

        return await categorySpecificHandlers[category][actionName](event, ...Object.values(args));
    });

    // Register hooks for category-specific file operations
    ipcMain.handle('kletron.file.select', async (event: Electron.IpcMainInvokeEvent, options: { category: string; [key: string]: unknown }) => {
        const handler = categorySpecificHandlers[options.category]?.selectFiles;
        if (handler) {
            return await handler(event);
        }
        return { cancelled: true };
    });

    // Register hooks for category-specific workspace operations
    ipcMain.handle('kletron.workspace.select', async (event: Electron.IpcMainInvokeEvent, options: { category: string; [key: string]: unknown }) => {
        const handler = categorySpecificHandlers[options.category]?.selectWorkspace;
        if (handler) {
            return await handler(event);
        }
        return { cancelled: true };
    });
}
