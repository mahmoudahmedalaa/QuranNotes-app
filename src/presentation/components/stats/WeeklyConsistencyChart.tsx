import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Spacing } from '../../theme/DesignSystem';

// const { width } = Dimensions.get('window');
const CHART_HEIGHT = 120;

export const WeeklyConsistencyChart: React.FC = () => {
    const theme = useTheme();

    // Mock data for individual days of the current week
    // In a real app, this would come from a Context/Database
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const data = [2, 5, 3, 8, 4, 6, 2]; // Number of verses/reflections per day
    const maxVal = Math.max(...data);

    return (
        <View style={styles.container}>
            <View style={styles.chartArea}>
                {data.map((val, i) => {
                    const barHeight = (val / maxVal) * CHART_HEIGHT;
                    return (
                        <View key={i} style={styles.barColumn}>
                            <MotiView
                                from={{ height: 0 }}
                                animate={{ height: barHeight }}
                                transition={{ type: 'timing', duration: 1000, delay: i * 100 }}
                                style={[
                                    styles.bar,
                                    {
                                        backgroundColor:
                                            i === 3
                                                ? theme.colors.primary
                                                : theme.colors.primaryContainer,
                                        opacity: i === 3 ? 1 : 0.7,
                                    },
                                ]}
                            />
                            <Text
                                style={[styles.dayText, { color: theme.colors.onSurfaceVariant }]}>
                                {days[i]}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingTop: Spacing.md,
        alignItems: 'center',
    },
    chartArea: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: '100%',
        height: CHART_HEIGHT + 30,
        paddingHorizontal: Spacing.sm,
    },
    barColumn: {
        alignItems: 'center',
        flex: 1,
    },
    bar: {
        width: 12,
        borderRadius: 6,
    },
    dayText: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: Spacing.sm,
    },
});
