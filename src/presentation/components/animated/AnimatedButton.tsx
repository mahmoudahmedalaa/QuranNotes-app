/**
 * AnimatedButton - Premium button with spring press animation
 *
 * Features:
 * - Scale + opacity animation on press
 * - Optional gradient background
 * - Haptic feedback
 * - Icon support
 */

import React from 'react';
import { StyleSheet, ViewStyle, Pressable } from 'react-native';
import { MotiView } from 'moti';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BorderRadius, Shadows, Spacing, Gradients } from '../../theme/DesignSystem';

interface AnimatedButtonProps {
    label: string;
    onPress: () => void;
    icon?: keyof typeof Ionicons.glyphMap;
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    fullWidth?: boolean;
    disabled?: boolean;
    style?: ViewStyle;
}

export const AnimatedButton = ({
    label,
    onPress,
    icon,
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    disabled = false,
    style,
}: AnimatedButtonProps) => {
    const theme = useTheme();

    const handlePress = () => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
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

    const iconSizes = {
        sm: 16,
        md: 18,
        lg: 22,
    };

    const renderContent = () => (
        <>
            {icon && (
                <Ionicons
                    name={icon}
                    size={iconSizes[size]}
                    color={variant === 'primary' ? '#FFFFFF' : theme.colors.primary}
                    style={styles.icon}
                />
            )}
            <Text
                style={[
                    styles.label,
                    { fontSize: textSizes[size] },
                    variant === 'primary' && styles.labelPrimary,
                    variant !== 'primary' && { color: theme.colors.primary },
                    disabled && { opacity: 0.5 },
                ]}>
                {label}
            </Text>
        </>
    );

    const containerStyle: ViewStyle = {
        ...sizeStyles[size],
        width: fullWidth ? '100%' : undefined,
        opacity: disabled ? 0.6 : 1,
    };

    // Primary variant with gradient
    if (variant === 'primary') {
        return (
            <Pressable
                onPress={handlePress}
                disabled={disabled}
                style={({ pressed }) => [styles.shadowPrimary, pressed && styles.pressed, style]}>
                <LinearGradient
                    colors={Gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.button, containerStyle]}>
                    {renderContent()}
                </LinearGradient>
            </Pressable>
        );
    }

    // Other variants
    return (
        <Pressable
            onPress={handlePress}
            disabled={disabled}
            style={({ pressed }) => [
                styles.button,
                containerStyle,
                variant === 'secondary' && { backgroundColor: theme.colors.primaryContainer },
                variant === 'outline' && {
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    borderColor: theme.colors.primary,
                },
                variant === 'ghost' && { backgroundColor: 'transparent' },
                pressed && styles.pressed,
                style,
            ]}>
            {renderContent()}
        </Pressable>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BorderRadius.xl,
    },
    pressed: {
        opacity: 0.8,
        transform: [{ scale: 0.96 }],
    },
    label: {
        fontWeight: '600',
    },
    labelPrimary: {
        color: '#FFFFFF',
    },
    icon: {
        marginRight: Spacing.xs,
    },
    shadowPrimary: {
        ...Shadows.primary,
    },
});

export default AnimatedButton;
