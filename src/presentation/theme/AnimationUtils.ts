/**
 * Animation Utilities for Premium Design
 *
 * Uses Moti (built on React Native Reanimated) for declarative animations
 * and custom spring presets for consistent motion feel.
 */

import { Easing } from 'react-native-reanimated';

// ═══════════════════════════════════════════════════════════════════════════
// SPRING PRESETS - Consistent motion feel across the app
// ═══════════════════════════════════════════════════════════════════════════

export const SpringConfig = {
    // Gentle - for subtle UI movements
    gentle: {
        type: 'spring' as const,
        damping: 20,
        stiffness: 100,
        mass: 1,
    },
    // Bouncy - for playful interactions
    bouncy: {
        type: 'spring' as const,
        damping: 12,
        stiffness: 150,
        mass: 0.8,
    },
    // Snappy - for quick responses
    snappy: {
        type: 'spring' as const,
        damping: 20,
        stiffness: 300,
        mass: 0.8,
    },
    // Smooth - for page transitions
    smooth: {
        type: 'spring' as const,
        damping: 18,
        stiffness: 80,
        mass: 1,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// TIMING PRESETS - For linear/eased animations
// ═══════════════════════════════════════════════════════════════════════════

export const TimingConfig = {
    // Fast - 200ms
    fast: {
        type: 'timing' as const,
        duration: 200,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    },
    // Medium - 300ms
    medium: {
        type: 'timing' as const,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    },
    // Slow - 500ms
    slow: {
        type: 'timing' as const,
        duration: 500,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTRANCE ANIMATIONS - For list items and cards
// ═══════════════════════════════════════════════════════════════════════════

export const EntranceAnimations = {
    // Fade + slide up
    fadeSlideUp: {
        from: {
            opacity: 0,
            translateY: 20,
        },
        animate: {
            opacity: 1,
            translateY: 0,
        },
    },
    // Fade + scale
    fadeScale: {
        from: {
            opacity: 0,
            scale: 0.9,
        },
        animate: {
            opacity: 1,
            scale: 1,
        },
    },
    // Just fade
    fade: {
        from: {
            opacity: 0,
        },
        animate: {
            opacity: 1,
        },
    },
    // Slide from right
    slideFromRight: {
        from: {
            opacity: 0,
            translateX: 30,
        },
        animate: {
            opacity: 1,
            translateX: 0,
        },
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// PRESS ANIMATIONS - For interactive elements
// ═══════════════════════════════════════════════════════════════════════════

export const PressAnimations = {
    // Scale down slightly
    scale: {
        pressed: { scale: 0.97 },
        default: { scale: 1 },
    },
    // Scale + opacity
    scaleOpacity: {
        pressed: { scale: 0.97, opacity: 0.9 },
        default: { scale: 1, opacity: 1 },
    },
    // Subtle lift (scale + shadow would need custom impl)
    lift: {
        pressed: { scale: 0.98, translateY: -2 },
        default: { scale: 1, translateY: 0 },
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// STAGGER DELAYS - For list animations
// ═══════════════════════════════════════════════════════════════════════════

export const getStaggerDelay = (index: number, baseDelay: number = 50) => {
    // Cap at 500ms total delay for long lists
    return Math.min(index * baseDelay, 500);
};

// ═══════════════════════════════════════════════════════════════════════════
// REDUCED MOTION - Respect user preference
// ═══════════════════════════════════════════════════════════════════════════

import { useReducedMotion } from 'react-native-reanimated';

export const useAnimationConfig = () => {
    const reducedMotion = useReducedMotion();

    return {
        shouldAnimate: !reducedMotion,
        spring: reducedMotion ? { duration: 0 } : SpringConfig.gentle,
        entrance: reducedMotion ? { from: {}, animate: {} } : EntranceAnimations.fadeSlideUp,
    };
};
