import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';

/**
 * Premium Design System
 * Inspired by Calm/Headspace - serene, minimal, luxurious
 *
 * Principles:
 * - Soft, calming colors (avoid harsh saturation)
 * - Layered depth with shadows
 * - Generous whitespace
 * - Subtle gradients
 */

// ═══════════════════════════════════════════════════════════════════════════
// COLORS - Serene Palette
// ═══════════════════════════════════════════════════════════════════════════

const lightColors = {
    // Backgrounds (layered depth)
    background: '#F8FAFB', // Soft off-white
    surface: '#FFFFFF', // Pure white cards
    surfaceVariant: '#F0F4F8', // Subtle gray for sections

    // Primary accent (used sparingly)
    primary: '#5B7FFF', // Soft blue-violet
    primaryContainer: '#E8EDFF', // Light primary wash
    onPrimary: '#FFFFFF',
    onPrimaryContainer: '#1A365D',

    // Secondary (warm accent)
    secondary: '#D4A853', // Elegant gold
    secondaryContainer: '#FDF6E3',
    onSecondary: '#FFFFFF',
    onSecondaryContainer: '#78350F',

    // Text hierarchy
    onBackground: '#1A1D21', // Near-black for headlines
    onSurface: '#2C3E50', // Softer for body text
    onSurfaceVariant: '#6B7C93', // Muted for captions

    // Semantic
    error: '#E53E3E',
    success: '#38A169',
    warning: '#D69E2E',
    info: '#3B82F6',

    // Charts & Data
    chartReading: '#79D2DE',
    chartReciting: '#177AD5',
    chartReflection: '#ED6665',
    chartEmpty: '#E5E7EB',

    // Heatmap (Blue/Purple scale)
    heatmapLow: '#B3C5FF',
    heatmapMedium: '#5B7FFF',
    heatmapHigh: '#7B5FFF',

    // Widgets (Stats)
    widgetOrange: '#F97316',
    widgetBlue: '#3B82F6',
    widgetPurple: '#8B5CF6',
    widgetPink: '#EC4899',

    // Misc
    outline: '#E2E8F0',
    divider: '#EDF2F7',
};

const darkColors = {
    background: '#0F1419',
    surface: '#1A1F26',
    surfaceVariant: '#252D38',

    primary: '#7B9EFF',
    primaryContainer: '#2D3A5F',
    onPrimary: '#0F1419',
    onPrimaryContainer: '#C7D5FF',

    secondary: '#E5B969',
    secondaryContainer: '#3D2E10',
    onSecondary: '#0F1419',
    onSecondaryContainer: '#FDE68A',

    onBackground: '#F1F5F9',
    onSurface: '#E2E8F0',
    onSurfaceVariant: '#94A3B8',

    error: '#FC8181',
    success: '#68D391',
    warning: '#F6E05E',

    // Charts & Data
    chartReading: '#5AC8D8', // Slightly brighter for dark mode
    chartReciting: '#3A9BEC',
    chartReflection: '#F28B8A',
    chartEmpty: '#2D3748',

    // Heatmap (Dark Mode)
    heatmapLow: '#5B7FFF',
    heatmapMedium: '#7B5FFF',
    heatmapHigh: '#7B5FFF',

    // Widgets (Stats)
    widgetOrange: '#FB923C',
    widgetBlue: '#60A5FA',
    widgetPurple: '#A78BFA',
    widgetPink: '#F472B6',

    outline: '#334155',
    divider: '#1E293B',
};

// ═══════════════════════════════════════════════════════════════════════════
// THEMES
// ═══════════════════════════════════════════════════════════════════════════

export const LightTheme = {
    ...MD3LightTheme,
    dark: false,
    colors: {
        ...MD3LightTheme.colors,
        ...lightColors,
    },
};

export const DarkTheme = {
    ...MD3DarkTheme,
    dark: true,
    colors: {
        ...MD3DarkTheme.colors,
        ...darkColors,
    },
};

export const PremiumTheme = LightTheme;
export const Colors = lightColors;

// ═══════════════════════════════════════════════════════════════════════════
// SPACING - Generous whitespace
// ═══════════════════════════════════════════════════════════════════════════

export const Spacing = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPOGRAPHY - Clean, modern
// ═══════════════════════════════════════════════════════════════════════════

export const Typography = {
    displayLarge: {
        fontSize: 32,
        fontWeight: '700' as const,
        letterSpacing: -0.5,
        lineHeight: 40,
    },
    displayMedium: {
        fontSize: 24,
        fontWeight: '600' as const,
        letterSpacing: -0.3,
        lineHeight: 32,
    },
    titleLarge: {
        fontSize: 20,
        fontWeight: '600' as const,
        lineHeight: 28,
    },
    titleMedium: {
        fontSize: 16,
        fontWeight: '600' as const,
        lineHeight: 24,
    },
    bodyLarge: {
        fontSize: 16,
        lineHeight: 24,
    },
    bodyMedium: {
        fontSize: 14,
        lineHeight: 20,
    },
    labelMedium: {
        fontSize: 12,
        fontWeight: '500' as const,
        letterSpacing: 0.5,
    },
    caption: {
        fontSize: 11,
        fontWeight: '400' as const,
        letterSpacing: 0.3,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// SHADOWS - Soft, multi-layered (premium feel)
// ═══════════════════════════════════════════════════════════════════════════

export const Shadows = {
    none: {},
    sm: {
        shadowColor: '#1A1D21',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor: '#1A1D21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    lg: {
        shadowColor: '#1A1D21',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
        elevation: 8,
    },
    // Colored shadows (for buttons)
    primary: {
        shadowColor: '#5B7FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
    },
};

// ═══════════════════════════════════════════════════════════════════════════
// BORDER RADIUS - Generous, modern
// ═══════════════════════════════════════════════════════════════════════════

export const BorderRadius = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 28,
    full: 9999,
};

// ═══════════════════════════════════════════════════════════════════════════
// GRADIENTS - Subtle, calming
// ═══════════════════════════════════════════════════════════════════════════

export const Gradients = {
    // Background gradients
    sereneSky: ['#E8EDFF', '#F8FAFB'] as const,
    calmSunset: ['#FDF6E3', '#F8FAFB'] as const,

    // Hero gradients
    primary: ['#5B7FFF', '#7B5FFF'] as const,
    gold: ['#D4A853', '#E5C76B'] as const,

    // Dark mode
    nightSky: ['#1A1F26', '#0F1419'] as const,
    cosmic: ['#1A1B2E', '#0F101F'] as const, // Deep cosmic purple
    lavender: ['#F3E8FF', '#FAF5FF'] as const, // Soft lavender
    ocean: ['#5B7FFF', '#4B6EDD', '#3A5DBB'] as const, // Ocean blue
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATION - Spring presets
// ═══════════════════════════════════════════════════════════════════════════

export const Springs = {
    gentle: { damping: 20, stiffness: 100 },
    bouncy: { damping: 12, stiffness: 150 },
    stiff: { damping: 20, stiffness: 300 },
};
