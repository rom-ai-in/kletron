/**
 * Numezis Design System - Motion Tokens
 * 
 * Animation durations, easing functions, and keyframe definitions.
 * Matches CSS variables in globals.css.
 * 
 * @example
 * import { motion } from '@numezis/ui/tokens';
 * <div style={{ transition: `all ${motion.duration.normal} ${motion.easing.default}` }} />
 */

// =============================================================================
// DURATION TOKENS
// =============================================================================

export const duration = {
    /** 0ms - Instant */
    instant: '0ms',
    /** 75ms - Very fast (micro-interactions) */
    fastest: '75ms',
    /** 150ms - Fast (hover states, small animations) */
    fast: 'var(--anim-duration-fast)',
    /** 300ms - Normal (most transitions) */
    normal: 'var(--anim-duration-normal)',
    /** 500ms - Slow (large animations, modals) */
    slow: 'var(--anim-duration-slow)',
    /** 1000ms - Slowest (page transitions) */
    slowest: '1000ms',
} as const;

// Raw values for JS animations
export const durationMs = {
    instant: 0,
    fastest: 75,
    fast: 150,
    normal: 300,
    slow: 500,
    slowest: 1000,
} as const;

// =============================================================================
// EASING FUNCTIONS
// =============================================================================

export const easing = {
    /** Standard easing for most animations */
    default: 'var(--anim-ease-default)',
    /** cubic-bezier(0.4, 0, 0.2, 1) - Smooth deceleration */
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    /** cubic-bezier(0.4, 0, 1, 1) - Acceleration */
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    /** cubic-bezier(0.4, 0, 0.2, 1) - Smooth both directions */
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    /** Bouncy effect for playful animations */
    bounce: 'var(--anim-ease-bounce)',
    /** Linear for spinners, loaders */
    linear: 'linear',
    /** Spring-like for interactive feedback */
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// =============================================================================
// TRANSITION PRESETS
// =============================================================================

export const transitions = {
    /** Quick color/opacity changes */
    colors: `color ${duration.fast}, background-color ${duration.fast}, border-color ${duration.fast}`,
    /** Opacity fade */
    opacity: `opacity ${duration.normal}`,
    /** Transform transitions (scale, translate) */
    transform: `transform ${duration.normal} ${easing.default}`,
    /** All properties */
    all: `all ${duration.normal} ${easing.default}`,
    /** Fast all */
    allFast: `all ${duration.fast} ${easing.default}`,
    /** Modal/panel appearance */
    modal: `opacity ${duration.normal}, transform ${duration.slow} ${easing.easeOut}`,
    /** Hover state */
    hover: `background-color ${duration.fast}`,
    /** Focus ring */
    focus: `box-shadow ${duration.fast}`,
} as const;

// =============================================================================
// ANIMATION KEYFRAMES (for CSS-in-JS)
// =============================================================================

export const keyframes = {
    fadeIn: {
        from: { opacity: 0 },
        to: { opacity: 1 },
    },
    fadeInUp: {
        from: { opacity: 0, transform: 'translateY(20px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
    },
    fadeInDown: {
        from: { opacity: 0, transform: 'translateY(-10px)' },
        to: { opacity: 1, transform: 'translateY(0)' },
    },
    scaleIn: {
        from: { opacity: 0, transform: 'scale(0.95)' },
        to: { opacity: 1, transform: 'scale(1)' },
    },
    slideInRight: {
        from: { transform: 'translateX(100%)' },
        to: { transform: 'translateX(0)' },
    },
    slideInLeft: {
        from: { transform: 'translateX(-100%)' },
        to: { transform: 'translateX(0)' },
    },
    spin: {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
    },
    pulse: {
        '0%, 100%': { opacity: 1 },
        '50%': { opacity: 0.5 },
    },
    bounce: {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-6px)' },
    },
} as const;

// =============================================================================
// UNIFIED EXPORT
// =============================================================================

export const motion = {
    duration,
    durationMs,
    easing,
    transitions,
    keyframes,
} as const;

// Type exports
export type Duration = keyof typeof duration;
export type Easing = keyof typeof easing;
export type Transition = keyof typeof transitions;
