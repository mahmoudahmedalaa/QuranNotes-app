/**
 * CatchUpBanner — Lightweight status text for Khatma progress
 * No heavy container, no checkmark icon. Just clean text.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Spacing } from '../../theme/DesignSystem';

// Warm accent colors
const ACCENT = {
    gold: '#F5A623',
    green: '#10B981',
    amber: '#F59E0B',
};

interface CatchUpBannerProps {
    isAhead: boolean;
    isBehind: boolean;
    isComplete: boolean;
    message: string;
    todayPagesRead?: number;
    todayTotalPages?: number;
    /** Total number of completed Juz for milestone messaging */
    completedCount?: number;
}

export const CatchUpBanner: React.FC<CatchUpBannerProps> = ({
    isAhead,
    isBehind,
    isComplete,
    message,
    todayPagesRead,
    todayTotalPages,
    completedCount,
}) => {
    const theme = useTheme();

    // Build contextual message with milestone support
    const displayMessage = (() => {
        if (isComplete) return 'Alhamdulillah! You\'ve completed the Khatma 🎉';
        // Milestone celebrations
        if (completedCount === 10) return '🎉 10 Juz complete! A third of the way there!';
        if (completedCount === 20) return '🎉 Two-thirds complete! Almost there!';
        if (todayPagesRead !== undefined && todayTotalPages !== undefined) {
            const remaining = todayTotalPages - todayPagesRead;
            if (remaining > 0 && todayPagesRead > 0) {
                return `${remaining} pages left today`;
            }
        }
        return message;
    })();

    const textColor = isComplete
        ? ACCENT.green
        : isBehind
            ? ACCENT.amber
            : isAhead
                ? ACCENT.green
                : theme.colors.onSurfaceVariant;

    return (
        <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 250 }}
        >
            <Text style={[styles.message, { color: textColor }]}>
                {displayMessage}
            </Text>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    message: {
        fontSize: 14,
        fontWeight: '600',
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.xs,
    },
});
