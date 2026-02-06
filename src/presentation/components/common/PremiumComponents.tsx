import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Shadows, BorderRadius, Spacing } from '../../theme/DesignSystem';

/**
 * Premium Components Library
 * Custom components with soft shadows, blur, and animations
 */

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM CARD - Soft shadow, rounded corners
// ═══════════════════════════════════════════════════════════════════════════

interface PremiumCardProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    variant?: 'elevated' | 'outlined' | 'glass';
    onPress?: () => void;
}

export function PremiumCard({ children, style, variant = 'elevated', onPress }: PremiumCardProps) {
    const theme = useTheme();

    const cardStyles = [
        styles.card,
        variant === 'elevated' && [{ backgroundColor: theme.colors.surface }, Shadows.md],
        variant === 'outlined' && {
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outline,
        },
        style,
    ];

    if (onPress) {
        return (
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onPress();
                }}
                style={({ pressed }) => [
                    ...cardStyles,
                    pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] },
                ]}>
                {children}
            </Pressable>
        );
    }

    return <View style={cardStyles}>{children}</View>;
}

// ═══════════════════════════════════════════════════════════════════════════
// GLASS CONTAINER - Blur effect for iOS-like depth
// ═══════════════════════════════════════════════════════════════════════════

interface GlassContainerProps {
    children: React.ReactNode;
    intensity?: number;
    style?: StyleProp<ViewStyle>;
}

export function GlassContainer({ children, intensity = 80, style }: GlassContainerProps) {
    return (
        <BlurView intensity={intensity} tint="light" style={[styles.glass, style]}>
            {children}
        </BlurView>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// PREMIUM BUTTON - Gradient background, subtle shadow, haptics
// ═══════════════════════════════════════════════════════════════════════════

interface PremiumButtonProps {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    icon?: React.ReactNode;
    disabled?: boolean;
}

export function PremiumButton({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    icon,
    disabled = false,
}: PremiumButtonProps) {
    const theme = useTheme();

    const handlePress = () => {
        if (!disabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onPress();
        }
    };

    const sizeStyles = {
        sm: { paddingVertical: 8, paddingHorizontal: 16 },
        md: { paddingVertical: 12, paddingHorizontal: 24 },
        lg: { paddingVertical: 16, paddingHorizontal: 32 },
    };

    const textSizes = {
        sm: 13,
        md: 15,
        lg: 17,
    };

    if (variant === 'primary') {
        return (
            <Pressable
                onPress={handlePress}
                disabled={disabled}
                style={({ pressed }) => [
                    styles.button,
                    Shadows.primary,
                    disabled && { opacity: 0.5 },
                    pressed && { transform: [{ scale: 0.96 }] },
                ]}>
                <LinearGradient
                    colors={['#5B7FFF', '#7B5FFF']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.buttonGradient, sizeStyles[size]]}>
                    {icon && <View style={styles.buttonIcon}>{icon}</View>}
                    <Text style={[styles.buttonText, { fontSize: textSizes[size] }]}>{label}</Text>
                </LinearGradient>
            </Pressable>
        );
    }

    if (variant === 'secondary') {
        return (
            <Pressable
                onPress={handlePress}
                disabled={disabled}
                style={({ pressed }) => [
                    styles.button,
                    styles.buttonSecondary,
                    { borderColor: theme.colors.primary },
                    disabled && { opacity: 0.5 },
                    pressed && { transform: [{ scale: 0.96 }] },
                ]}>
                <View style={sizeStyles[size]}>
                    {icon && <View style={styles.buttonIcon}>{icon}</View>}
                    <Text
                        style={[
                            styles.buttonTextSecondary,
                            { color: theme.colors.primary, fontSize: textSizes[size] },
                        ]}>
                        {label}
                    </Text>
                </View>
            </Pressable>
        );
    }

    // Ghost variant
    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled}
            style={({ pressed }) => [
                sizeStyles[size],
                disabled && { opacity: 0.5 },
                pressed && { opacity: 0.7 },
            ]}>
            {icon && <View style={styles.buttonIcon}>{icon}</View>}
            <Text
                style={[
                    styles.buttonTextGhost,
                    { color: theme.colors.primary, fontSize: textSizes[size] },
                ]}>
                {label}
            </Text>
        </Pressable>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION HEADER - For list sections
// ═══════════════════════════════════════════════════════════════════════════

interface SectionHeaderProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, action }: SectionHeaderProps) {
    const theme = useTheme();

    return (
        <View style={styles.sectionHeader}>
            <View>
                <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                    {title}
                </Text>
                {subtitle && (
                    <Text
                        style={[styles.sectionSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {subtitle}
                    </Text>
                )}
            </View>
            {action}
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE - Soft pill-shaped labels
// ═══════════════════════════════════════════════════════════════════════════

interface BadgeProps {
    label: string;
    color?: string;
    variant?: 'filled' | 'subtle';
}

export function Badge({ label, color = '#5B7FFF', variant = 'subtle' }: BadgeProps) {
    return (
        <View
            style={[
                styles.badge,
                variant === 'filled'
                    ? { backgroundColor: color }
                    : { backgroundColor: color + '15' },
            ]}>
            <Text style={[styles.badgeText, { color: variant === 'filled' ? '#FFF' : color }]}>
                {label}
            </Text>
        </View>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
    // Card
    card: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },

    // Glass
    glass: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        padding: Spacing.lg,
    },

    // Button
    button: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    buttonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonSecondary: {
        borderWidth: 2,
        backgroundColor: 'transparent',
    },
    buttonIcon: {
        marginRight: Spacing.sm,
    },
    buttonText: {
        color: '#FFF',
        fontWeight: '600',
    },
    buttonTextSecondary: {
        fontWeight: '600',
    },
    buttonTextGhost: {
        fontWeight: '600',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    sectionSubtitle: {
        fontSize: 13,
        marginTop: 2,
    },

    // Badge
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
});
