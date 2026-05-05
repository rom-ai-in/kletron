// apps/desktop/src/ipc/categoryActions.ts

/**
 * Category-specific native actions for Electron desktop app.
 * Provides platform-specific integrations for each work category.
 */

import { shell, Notification } from 'electron';

// ============================================================================
// TYPES
// ============================================================================

export type CategoryAction =
  // Coding actions
  | { action: 'openInVSCode'; filePath?: string }
  | { action: 'showGitStatus' }
  | { action: 'openTerminal'; cwd?: string }
  | { action: 'runCommand'; command: string; cwd?: string }
  // Drafting actions
  | { action: 'openInPages'; filePath: string }
  | { action: 'printDocument'; filePath: string; options?: Record<string, unknown> }
  | { action: 'exportDocument'; filePath: string; format: 'pdf' | 'docx' | 'txt' }
  // Automation actions
  | { action: 'scheduleNotification'; title: string; body: string; timestamp?: number }
  | { action: 'openCalendarEvent'; eventId?: string }
  | { action: 'openReminders'; query?: string }
  // General actions
  | { action: 'openFile'; filePath: string }
  | { action: 'showInFinder'; filePath: string };

// ============================================================================
// CATEGORY SPECIFIC HANDLERS
// ============================================================================

const categoryHandlers: Record<string, Record<string, (args?: Record<string, unknown>) => Promise<unknown>>> = {
  coding: {
    /** Open file in VS Code */
    openInVSCode: async (args?: Record<string, unknown>) => {
      const filePath = (args?.filePath as string) || '';
      if (filePath) {
        await shell.openExternal(`vscode://file/${filePath}`);
      } else {
        await shell.openExternal('vscode://');
      }
      return { success: true };
    },

    /** Show Git status */
    showGitStatus: async () => {
      // Return Git status data (would be computed by the main process)
      return { success: true, message: 'Git status retrieved' };
    },

    /** Open terminal in workspace */
    openTerminal: async (args?: Record<string, unknown>) => {
      const _cwd = (args?.cwd as string) || process.cwd();
      await shell.openPath(_cwd);
      return { success: true };
    },

    /** Run command in workspace */
    runCommand: async (args?: Record<string, unknown>) => {
      const command = (args?.command as string) || '';
      const _cwd = (args?.cwd as string) || process.cwd();
      // Would spawn a child process here
      return { success: true, command };
    },
  },

  drafting: {
    /** Open file in Apple Pages */
    openInPages: async (args?: Record<string, unknown>) => {
      const filePath = (args?.filePath as string) || '';
      if (filePath) {
        await shell.openPath(filePath);
      }
      return { success: true };
    },

    /** Print document */
    printDocument: async (args?: Record<string, unknown>) => {
      const filePath = (args?.filePath as string) || '';
      const options = (args?.options as Record<string, unknown>) || {};
      // Would use print service here
      return { success: true, filePath, options };
    },

    /** Export document */
    exportDocument: async (args?: Record<string, unknown>) => {
      const filePath = (args?.filePath as string) || '';
      const format = (args?.format as 'pdf' | 'docx' | 'txt') || 'pdf';
      // Would use export service here
      return { success: true, filePath, format };
    },
  },

  automation: {
    /** Schedule a notification */
    scheduleNotification: async (args?: Record<string, unknown>) => {
      const title = (args?.title as string) || 'Kletron';
      const body = (args?.body as string) || '';
      const timestamp = (args?.timestamp as number) || Date.now() + 60000;

      // Show immediate notification
      const notification = new Notification({
        title,
        body,
        sound: 'default',
      });

      // Schedule delayed notification if needed
      if (timestamp > Date.now()) {
        setTimeout(() => {
          notification.show();
        }, timestamp - Date.now());
      } else {
        notification.show();
      }

      return { success: true, timestamp };
    },

    /** Open calendar event */
    openCalendarEvent: async (args?: Record<string, unknown>) => {
      const eventId = (args?.eventId as string) || '';
      if (eventId) {
        await shell.openExternal(`x-apple://calendar/event/${eventId}`);
      } else {
        await shell.openExternal('x-apple://calendar');
      }
      return { success: true };
    },

    /** Open reminders */
    openReminders: async (args?: Record<string, unknown>) => {
      const query = (args?.query as string) || '';
      if (query) {
        await shell.openExternal(`x-apple-reminders://search?q=${encodeURIComponent(query)}`);
      } else {
        await shell.openExternal('x-apple-reminders://');
      }
      return { success: true };
    },
  },

  general: {
    /** Open file in default app */
    openFile: async (args?: Record<string, unknown>) => {
      const filePath = (args?.filePath as string) || '';
      if (filePath) {
        await shell.openPath(filePath);
      }
      return { success: true };
    },

    /** Show file in Finder */
    showInFinder: async (args?: Record<string, unknown>) => {
      const filePath = (args?.filePath as string) || '';
      if (filePath) {
        await shell.showItemInFolder(filePath);
      }
      return { success: true };
    },
  },
};

// ============================================================================
// IPC HANDLER
// ============================================================================

/**
 * Handle category-specific actions via IPC.
 * This should be registered in the main process.
 */
export function registerCategoryActions(ipcMain: typeof import('electron').ipcMain) {
  ipcMain.handle('kletron.categoryAction', async (_event, action: CategoryAction) => {
    const handler = categoryHandlers[action.action.split(':')[0]]?.[action.action.split(':')[1]];
    if (!handler) {
      throw new Error(`Action ${action.action} not supported for category ${action.action.split(':')[0]}`);
    }

    try {
      return await handler(action);
    } catch (error) {
      console.error(`Category action failed: ${action.action}`, error);
      throw error;
    }
  });
}

// ============================================================================
// DEEP LINK HANDLER
// ============================================================================

export interface DeepLinkResult {
  type: string;
  path?: string;
  query?: string;
}

export function handleDeepLink(url: string, category: string): DeepLinkResult | null {
  const categoryHandlers = {
    coding: {
      'vscode://': (url: string) => {
        const match = url.match(/^vscode:\/\/(file|extension|workspace)\/(.*)$/);
        if (match) {
          return { type: 'vscode', path: decodeURIComponent(match[2]) };
        }
        return null;
      },
      'git://': (url: string) => {
        const match = url.match(/^git:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\.git)?$/);
        if (match) {
          return { type: 'git', owner: match[1], repo: match[2] };
        }
        return null;
      },
    },
    drafting: {
      'pages://': (url: string) => {
        const match = url.match(/^pages:\/\/(.*)$/);
        if (match) {
          return { type: 'pages', path: decodeURIComponent(match[1]) };
        }
        return null;
      },
      'preview://': (url: string) => {
        const match = url.match(/^preview:\/\/(.*)$/);
        if (match) {
          return { type: 'preview', path: decodeURIComponent(match[1]) };
        }
        return null;
      },
    },
    automation: {
      'webcal://': (url: string) => {
        const match = url.match(/^webcal:\/\/calendar\?(.*)$/);
        if (match) {
          return { type: 'calendar', query: decodeURIComponent(match[1]) };
        }
        return null;
      },
      'x-apple-reminder://': (url: string) => {
        const match = url.match(/^x-apple-reminder:\/\/(.*)$/);
        if (match) {
          return { type: 'reminder', id: decodeURIComponent(match[1]) };
        }
        return null;
      },
    },
  };

  // Try category-specific handlers first
  const categoryHandler = categoryHandlers[category as keyof typeof categoryHandlers];
  if (categoryHandler) {
    for (const [protocol, handlerFunc] of Object.entries(categoryHandler)) {
      if (url.startsWith(protocol)) {
        const result = handlerFunc(url);
        if (result) return result;
      }
    }
  }

  // Fall back to general handlers
  return handleGeneralDeepLink(url);
}

function handleGeneralDeepLink(url: string): DeepLinkResult | null {
  // Handle http/https URLs
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return { type: 'url', path: url };
  }

  // Handle file:// URLs
  if (url.startsWith('file://')) {
    return { type: 'file', path: decodeURIComponent(url.replace('file://', '')) };
  }

  return null;
}

// ============================================================================
// NOTIFICATION CENTER
// ============================================================================

export interface NotificationOptions {
  title: string;
  body: string;
  category: string;
  action?: {
    type: string;
    path?: string;
  };
  silent?: boolean;
}

export class CategoryAwareNotificationCenter {
  private static instance: CategoryAwareNotificationCenter;

  private constructor() {}

  static getInstance(): CategoryAwareNotificationCenter {
    if (!CategoryAwareNotificationCenter.instance) {
      CategoryAwareNotificationCenter.instance = new CategoryAwareNotificationCenter();
    }
    return CategoryAwareNotificationCenter.instance;
  }

  showNotification(options: NotificationOptions): void {
    const config = this.getCategoryConfig(options.category);

    const notification = new Notification({
      title: options.title || config.defaultTitle,
      body: options.body,
      sound: config.sound,
      silent: options.silent !== false,
    });

    // Handle action on click
    if (options.action) {
      notification.on('click', () => {
        if (options.action?.type === 'openFile' && options.action.path) {
          void shell.openPath(options.action.path);
        }
      });
    }

    notification.show();
  }

  private getCategoryConfig(category: string): { defaultTitle: string; sound: string; icon: string } {
    const configs: Record<string, { defaultTitle: string; sound: string; icon: string }> = {
      coding: {
        defaultTitle: 'Code Assistance',
        sound: 'default',
        icon: '',
      },
      drafting: {
        defaultTitle: 'Document Ready',
        sound: 'glass',
        icon: '',
      },
      automation: {
        defaultTitle: 'Automation Update',
        sound: 'hero',
        icon: '',
      },
    };

    return configs[category] || { defaultTitle: 'Kletron', sound: 'default', icon: '' };
  }
}

export const notificationCenter = CategoryAwareNotificationCenter.getInstance();
