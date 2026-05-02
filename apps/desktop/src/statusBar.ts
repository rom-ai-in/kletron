// apps/desktop/src/statusBar.ts - Category status bar

import { Menu, nativeImage, Tray } from "electron";
import * as path from "path";

interface CategoryConfig {
  icon: string;
  color: string;
  tooltip: string;
}

/**
 * Category-aware status bar (menu bar icon) — Code vs Work.
 */
export class CategoryStatusBar {
  private tray: Tray | null;
  private currentCategory: string;
  private categoryConfigs: Record<string, CategoryConfig>;

  constructor() {
    this.tray = null;
    this.currentCategory = "code";
    this.categoryConfigs = {
      code: {
        icon: path.join(__dirname, "../assets/icons/status-coding.png"),
        color: "#3B82F6",
        tooltip: "Kletron — Code mode",
      },
      work: {
        icon: path.join(__dirname, "../assets/icons/status-general.png"),
        color: "#6366F1",
        tooltip: "Kletron — Work mode",
      },
    };
  }

  initialize(): void {
    const config = this.getCategoryConfig(this.currentCategory);
    const icon = nativeImage.createFromPath(config.icon);

    this.tray = new Tray(icon.resize({ width: 16, height: 16 }));
    this.tray.setToolTip(config.tooltip);

    this.tray.on("click", () => {
      this.showCategorySwitcher();
    });

    this.tray.on("right-click", () => {
      this.showContextMenu();
    });
  }

  updateForCategory(category: string): void {
    const normalized = category === "work" ? "work" : "code";
    this.currentCategory = normalized;
    const config = this.getCategoryConfig(normalized);

    if (this.tray) {
      const icon = nativeImage.createFromPath(config.icon);
      this.tray.setImage(icon.resize({ width: 16, height: 16 }));
      this.tray.setToolTip(config.tooltip);
    }
  }

  showCategorySwitcher(): void {
    const template = [
      {
        label: "Switch mode",
        submenu: [
          {
            label: "Code",
            type: "checkbox",
            checked: this.currentCategory === "code",
            click: () => this.emitCategoryChange("code"),
          },
          {
            label: "Work",
            type: "checkbox",
            checked: this.currentCategory === "work",
            click: () => this.emitCategoryChange("work"),
          },
        ],
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          require("electron").app.quit();
        },
      },
    ];

    const menu = Menu.buildFromTemplate(template as Electron.MenuItemConstructorOptions[]);
    if (this.tray) {
      this.tray.popUpContextMenu(menu);
    }
  }

  private showContextMenu(): void {
    const template = [
      {
        label: "Open Kletron",
        click: () => {
          const { BrowserWindow } = require("electron");
          const win = BrowserWindow.getAllWindows()[0];
          if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
          }
        },
      },
      { type: "separator" },
      {
        label: "Switch mode",
        click: () => this.showCategorySwitcher(),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          require("electron").app.quit();
        },
      },
    ];

    const menu = Menu.buildFromTemplate(template);
    if (this.tray) {
      this.tray.popUpContextMenu(menu);
    }
  }

  private emitCategoryChange(category: string): void {
    const normalized = category === "work" ? "work" : "code";
    this.currentCategory = normalized;
    this.updateForCategory(normalized);

    const { BrowserWindow } = require("electron");
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win: Electron.BrowserWindow) => {
      win.webContents.send("kletron-category-changed", {
        category: normalized,
        timestamp: Date.now(),
      });
    });
  }

  private getCategoryConfig(category: string): CategoryConfig {
    const key = category === "work" ? "work" : "code";
    return this.categoryConfigs[key] || this.categoryConfigs.code;
  }
}

export const categoryStatusBar = new CategoryStatusBar();
