// apps/desktop/src/iconManager.ts - Category icon manager

import { nativeImage, nativeTheme } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

interface CategoryIconConfig {
    color: string;
    shape: string;
}

/**
 * Category-aware icon manager
 */
export class CategoryIconManager {
    private iconCache: Map<string, nativeImage>;
    private basePath: string;
    private iconIndicators: Record<string, CategoryIconConfig>;

    constructor() {
        this.iconCache = new Map();
        this.basePath = path.join(__dirname, '../assets/icons');
        this.iconIndicators = {
            coding: { color: '#3B82F6', shape: 'square' },
            drafting: { color: '#10B981', shape: 'circle' },
            automation: { color: '#F59E0B', shape: 'hexagon' },
            general: { color: '#6B7280', shape: 'circle' }
        };
    }

    /**
     * Get app icon for a category
     */
    async getAppIcon(category: string): Promise<nativeImage> {
        // Check cache first
        if (this.iconCache.has(category)) {
            return this.iconCache.get(category)!;
        }

        // Determine appropriate icon
        const iconName = await this.determineIconName(category);
        const iconPath = path.join(this.basePath, `${iconName}.icns`);

        // Load and cache icon
        let icon: nativeImage;
        if (fs.existsSync(iconPath)) {
            icon = nativeImage.createFromPath(iconPath);
        } else {
            // Fallback to default
            const defaultIconPath = path.join(this.basePath, 'default.icns');
            icon = fs.existsSync(defaultIconPath)
                ? nativeImage.createFromPath(defaultIconPath)
                : nativeImage.createEmpty();
        }

        this.iconCache.set(category, icon);
        return icon;
    }

    /**
     * Get dock icon with category indicator
     */
    async getDockIcon(category: string): Promise<nativeImage> {
        const baseIcon = await this.getAppIcon(category);
        const indicator = this.iconIndicators[category] || this.iconIndicators.general;

        // Create indicator
        const indicatorImage = this.createIndicator(indicator);

        // Composite with base icon
        return this.compositeImages(baseIcon, indicatorImage, indicator.shape);
    }

    /**
     * Create category indicator
     */
    private createIndicator(config: CategoryIconConfig): nativeImage {
        // In production, load from file or create with canvas
        return nativeImage.createEmpty();
    }

    /**
     * Composite two images
     */
    private compositeImages(base: nativeImage, overlay: nativeImage, shape: string): nativeImage {
        // In production, use canvas or image processing
        return base;
    }

    /**
     * Determine icon name based on category and theme
     */
    private async determineIconName(category: string): Promise<string> {
        // Check for user preference
        const pref = await this.getUserPreference('iconStyle', category);
        if (pref && pref !== 'default') {
            return `${category}-${pref}`;
        }

        // Use system appearance
        if (nativeTheme.shouldUseDarkColors) {
            return `${category}-dark`;
        }

        return category;
    }

    /**
     * Get user preference
     */
    private async getUserPreference(key: string, category: string): Promise<string | null> {
        // In production, read from settings
        return null;
    }

    /**
     * Clear icon cache
     */
    clearCache(): void {
        this.iconCache.clear();
    }
}

// Singleton instance
export const categoryIconManager = new CategoryIconManager();
