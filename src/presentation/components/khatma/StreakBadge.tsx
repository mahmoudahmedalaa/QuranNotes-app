/**
 * StreakBadge — Inline reading streak indicator
 * Shows "🔥 N-day streak" when streak > 0
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { BorderRadius, Spacing } from '../../theme/DesignSystem';

const ACCENT = {
    amber: '#F59E0B',
    amberLight: '#F59E0B20',
};

interface StreakBadgeProps {
    streakDays: number;
}

export const StreakBadge: React.FC<StreakBadgeProps> = ({ streakDays }) => {
    const theme = useTheme();

    if (streakDays <= 0) return null;

    return (
        <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
        >
            <View style={[styles.badge, { backgroundColor: ACCENT.amberLight }]}>
                <Text style={styles.emoji}>🔥</Text>
                <Text style={[styles.text, { color: ACCENT.amber }]}>
                    {streakDays}-day streak
                </Text>
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: BorderRadius.full,
        alignSelf: 'center',
    },
    emoji: {
        fontSize: 14,
    },
    text: {
        fontSize: 13,
        fontWeight: '700',
    },
});
