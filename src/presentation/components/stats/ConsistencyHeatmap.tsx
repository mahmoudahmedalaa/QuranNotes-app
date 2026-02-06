import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ContributionGraph } from 'react-native-chart-kit';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const { width } = Dimensions.get('window');

interface ConsistencyHeatmapProps {
    data: { date: string; count: number }[];
}

export const ConsistencyHeatmap: React.FC<ConsistencyHeatmapProps> = ({ data }) => {
    const theme = useTheme();
    const endDate = new Date(); // today

    // Mock data if empty
    const chartData =
        data.length > 0
            ? data
            : [
                  { date: '2025-01-05', count: 1 },
                  { date: '2025-01-06', count: 3 },
              ];

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>Consistency</Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Last 90 days
                </Text>
            </View>

            <View style={styles.graphContainer}>
                <ContributionGraph
                    values={chartData}
                    endDate={endDate}
                    numDays={90}
                    width={width - Spacing.lg * 3} // Adjust width
                    height={220}
                    chartConfig={{
                        backgroundColor: theme.colors.surface,
                        backgroundGradientFrom: theme.colors.surface,
                        backgroundGradientTo: theme.colors.surface,
                        color: (opacity = 1) => {
                            // Professional monochromatic blue scale
                            // We ignore the opacity arg from the library mostly to control our own shades if needed
                            // But standard library usage:
                            return `rgba(79, 70, 229, ${opacity})`; // Indigo
                        },
                        labelColor: (opacity = 1) => theme.colors.onSurfaceVariant,
                        strokeWidth: 2,
                    }}
                    gutterSize={4}
                    squareSize={19}
                    showMonthLabels={true}
                    tooltipDataAttrs={() => ({})}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
    },
    subtitle: {
        fontSize: 12,
    },
    graphContainer: {
        alignItems: 'center',
        marginLeft: -10, // Slight optical adjustment
    },
});
