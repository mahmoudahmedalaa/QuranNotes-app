import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Shadows, Colors } from '../../theme/DesignSystem';
import { MotiView } from 'moti';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.md * 3) / 2;

interface StatCardProps {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    color: string;
    delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, delay = 0 }) => {
    const theme = useTheme();
    return (
        <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 400, delay }}
            style={[styles.card, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
            <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View>
                <Text style={[styles.value, { color: theme.colors.onSurface }]}>{value}</Text>
                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                    {label}
                </Text>
            </View>
        </MotiView>
    );
};

interface StatsWidgetGridProps {
    currentStreak: number;
    totalTime: string;
    versesRead: number;
    recordingsCount: number;
}

export const StatsWidgetGrid: React.FC<StatsWidgetGridProps> = ({
    currentStreak,
    totalTime,
    versesRead,
    recordingsCount,
}) => {
    return (
        <View style={styles.grid}>
            <StatCard
                icon="flame"
                label="Current Streak"
                value={`${currentStreak || 0} Days`}
                color={Colors.widgetOrange}
                delay={100}
            />
            <StatCard
                icon="time"
                label="Total Time"
                value={totalTime || '0m'}
                color={Colors.widgetBlue}
                delay={200}
            />
            <StatCard
                icon="book"
                label="Reflections"
                value={(versesRead || 0).toLocaleString()}
                color={Colors.widgetPurple}
                delay={300}
            />
            <StatCard
                icon="mic"
                label="Recordings"
                value={(recordingsCount || 0).toString()}
                color={Colors.widgetPink}
                delay={400}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.md,
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
    },
    card: {
        width: CARD_WIDTH,
        padding: Spacing.md,
        borderRadius: BorderRadius.xl,
        flexDirection: 'column',
        gap: Spacing.sm,
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    value: {
        fontSize: 24,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    label: {
        fontSize: 13,
        fontWeight: '500',
    },
});
