/**
 * CatchUpBanner — Simple progress message for Khatma
 * No schedule/catch-up logic — just shows completion progress.
 */
import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Spacing } from '../../theme/DesignSystem';

const ACCENT = {
    gold: '#F5A623',
    green: '#10B981',
};

interface CatchUpBannerProps {
    isComplete: boolean;
    completedCount: number;
}

export const CatchUpBanner: React.FC<CatchUpBannerProps> = ({
    isComplete,
    completedCount,
}) => {
    const theme = useTheme();

    const getMessage = () => {
        if (isComplete) return 'Alhamdulillah! You\'ve completed the Khatma 🎉';
        if (completedCount === 0) return 'Read at your own pace. Tap a Juz to begin.';
        if (completedCount <= 5) return `Great start! ${completedCount} of 30 Juz complete`;
        if (completedCount === 10) return '🎉 10 Juz complete! A third of the way!';
        if (completedCount === 15) return '🎉 Halfway there! 15 of 30 Juz';
        if (completedCount === 20) return '🎉 Two-thirds done! Keep going!';
        if (completedCount >= 25) return `Almost there! ${completedCount} of 30 Juz`;
        return `${completedCount} of 30 Juz complete`;
    };

    const textColor = isComplete
        ? ACCENT.green
        : completedCount >= 25
            ? ACCENT.green
            : completedCount >= 15
                ? ACCENT.gold
                : theme.colors.onSurfaceVariant;

    return (
        <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'timing', duration: 400, delay: 250 }}
        >
            <Text style={[styles.message, { color: textColor }]}>
                {getMessage()}
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
