import React from 'react';
import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { Text, useTheme, Surface } from 'react-native-paper';
import { useStreaks } from '../../../infrastructure/auth/StreakContext';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const { width } = Dimensions.get('window');
const PADDING = Spacing.md * 2 + Spacing.sm * 2; // Approximate padding
const GAP = 4;
const WEEKS = 15;
const BOX_SIZE = (width - PADDING - (WEEKS - 1) * GAP) / WEEKS;

export const ReflectionHeatmap: React.FC = () => {
    const { streak } = useStreaks();
    const theme = useTheme();

    // Generate dates for the last ~90 days (13 weeks x 7 days)
    const generateGrid = () => {
        const grid: { dateStr: string; intensity: number }[][] = [];
        const today = new Date();

        for (let week = 0; week < WEEKS; week++) {
            const weekData = [];
            for (let day = 0; day < 7; day++) {
                const daysAgo = (WEEKS - 1 - week) * 7 + (6 - day);
                const date = new Date(today);
                date.setDate(date.getDate() - daysAgo);
                const dateStr = date.toISOString().split('T')[0];
                const intensity = (streak.activityHistory && streak.activityHistory[dateStr]) || 0;
                weekData.push({ dateStr, intensity });
            }
            grid.push(weekData);
        }
        return grid;
    };

    const gridData = generateGrid();

    const getBoxColor = (intensity: number) => {
        const colors = theme.colors as typeof theme.colors & {
            chartEmpty: string;
            heatmapLow: string;
            heatmapMedium: string;
            heatmapHigh: string;
        };
        if (intensity === 0) return colors.chartEmpty;
        if (intensity === 1) return colors.heatmapLow;
        if (intensity === 2) return colors.heatmapMedium;
        return colors.heatmapHigh; // 3+ reflections
    };

    return (
        <Surface
            style={[styles.container, { backgroundColor: theme.colors.surface }]}
            elevation={1}>
            <View style={styles.headerRow}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                    Reflection Activity
                </Text>
                <View style={styles.legend}>
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                        Less
                    </Text>
                    {[0, 1, 2, 3].map(i => (
                        <View
                            key={i}
                            style={[styles.legendBox, { backgroundColor: getBoxColor(i) }]}
                        />
                    ))}
                    <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>
                        More
                    </Text>
                </View>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}>
                <View style={styles.gridContainer}>
                    {gridData.map((week, weekIdx) => (
                        <View key={weekIdx} style={styles.weekColumn}>
                            {week.map(day => (
                                <View
                                    key={day.dateStr}
                                    style={[
                                        styles.box,
                                        { backgroundColor: getBoxColor(day.intensity) },
                                    ]}
                                />
                            ))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </Surface>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: 14,
        fontWeight: '600',
    },
    scrollContent: {
        paddingRight: Spacing.xs,
    },
    gridContainer: {
        flexDirection: 'row',
        gap: GAP,
    },
    weekColumn: {
        gap: GAP,
    },
    box: {
        width: BOX_SIZE,
        height: BOX_SIZE,
        borderRadius: 2,
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    legendBox: {
        width: 8,
        height: 8,
        borderRadius: 2,
    },
    legendText: {
        fontSize: 9,
    },
});
