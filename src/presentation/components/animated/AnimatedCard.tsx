/**
 * AnimatedCard - Premium card with press animation and entrance effects
 *
 * Features:
 * - Scale animation on press with haptic feedback
 * - Staggered fade-in entrance for lists
 * - Shadow lift effect
 */

import React, { useCallback } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { useTheme } from 'react-native-paper';
import * as Haptics from 'expo-haptics';
import { getStaggerDelay } from '../../theme/AnimationUtils';
import { Shadows, BorderRadius, Spacing } from '../../theme/DesignSystem';

interface AnimatedCardProps {
    children: React.ReactNode;
    onPress?: () => void;
    style?: ViewStyle;
    index?: number;
    disabled?: boolean;
    elevation?: 'sm' | 'md' | 'lg';
}

export const AnimatedCard = ({
    children,
    onPress,
    style,
    index = 0,
    disabled = false,
    elevation = 'md',
}: AnimatedCardProps) => {
    const theme = useTheme();

    const handlePress = useCallback(() => {
        if (disabled || !onPress) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    }, [disabled, onPress]);

    return (
        <MotiView
            from={{
                opacity: 0,
                translateY: 16,
                scale: 0.98,
            }}
            animate={{
                opacity: 1,
                translateY: 0,
                scale: 1,
            }}
            transition={{
                type: 'spring',
                damping: 20,
                stiffness: 100,
                delay: getStaggerDelay(index),
            }}>
            <Pressable
                onPress={handlePress}
                disabled={disabled || !onPress}
                style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows[elevation],
                    pressed && styles.cardPressed,
                    style,
                ]}>
                {children}
            </Pressable>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        marginVertical: Spacing.xs,
    },
    cardPressed: {
        opacity: 0.95,
        transform: [{ scale: 0.97 }],
    },
});

export default AnimatedCard;
