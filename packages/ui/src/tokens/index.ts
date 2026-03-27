/**
 * Kletron Design System - Token Exports
 * 
 * Central barrel file for all design tokens.
 * Use this for consistent imports across the application.
 * 
 * @example
 * import { colors, spacing, typography, motion } from '@kletron/ui/tokens';
 * 
 * // Access specific color values
 * const bg = colors.bgSurface;       // CSS var: var(--bg-surface)
 * const border = colors.subtle;      // CSS var: var(--border-subtle)
 * const textColor = colors.text.primary; // CSS var: var(--text-primary)
 * 
 * // Spacing values
 * const pad = spacing.base;          // '1rem' (16px)
 * const gap = spacing.sm;            // '0.5rem' (8px)
 * 
 * // Typography
 * const font = typography.fontFamily.mono;
 */

// Individual token exports
export { colors, surfaces, borders, text, states, chain, ide, brand, agent, rawColors } from './colors';
export type { SurfaceColor, BorderColor, TextColor, StateColor, ChainColor, IdeColor, BrandColor, AgentColor } from './colors';

export { spacing, componentSpacing, gaps } from './spacing';
export type { SpacingToken, GapToken } from './spacing';

export { radius, rawRadius, componentRadius } from './radius';
export type { RadiusToken } from './radius';

export { typography, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, textStyles } from './typography';
export type { FontFamily, FontSize, FontWeight, LineHeight, TextStyle } from './typography';

export { motion, duration, durationMs, rawDuration, rawEasing, easing, transitions, keyframes } from './motion';
export type { Duration, Easing, Transition } from './motion';

export { shadows, glows, componentShadows } from './shadows';
export type { Shadow, Glow } from './shadows';

export { zIndex, layerIndex } from './z-index';
export type { ZIndex, LayerIndex } from './z-index';

export { glass, glassSurfaces, glassBorders, glassBlur } from './glass';

// =============================================================================
// UNIFIED TOKEN OBJECT (for convenience)
// =============================================================================

import { colors as _colors } from './colors';
import { spacing as _spacing, componentSpacing as _componentSpacing } from './spacing';
import { radius as _radius, componentRadius as _componentRadius } from './radius';
import { typography as _typography } from './typography';
import { motion as _motion } from './motion';
import { shadows as _shadows, glows as _glows, componentShadows as _componentShadows } from './shadows';
import { zIndex as _zIndex, layerIndex as _layerIndex } from './z-index';
import { glass as _glass } from './glass';

/**
 * All design tokens in a single object.
 * Useful for passing to theme providers or configuration.
 */
export const tokens = {
    colors: _colors,
    spacing: _spacing,
    componentSpacing: _componentSpacing,
    radius: _radius,
    componentRadius: _componentRadius,
    typography: _typography,
    motion: _motion,
    shadows: _shadows,
    glows: _glows,
    componentShadows: _componentShadows,
    zIndex: _zIndex,
    layerIndex: _layerIndex,
    glass: _glass,
} as const;

export type Tokens = typeof tokens;
