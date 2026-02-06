import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { PieChart } from 'react-native-gifted-charts';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const { width } = Dimensions.get('window');

interface TopicBreakdownProps {
    data: { value: number; color: string; text: string; label?: string; focused?: boolean }[];
    totalTime: string;
}

export const TopicBreakdown: React.FC<TopicBreakdownProps> = ({ data = [], totalTime }) => {
    const theme = useTheme();

    const renderDot = (color: string) => {
        return (
            <View
                style={{
                    height: 10,
                    width: 10,
                    borderRadius: 5,
                    backgroundColor: color,
                    marginRight: 10,
                }}
            />
        );
    };

    const LegendComponent = () => (
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, gap: 16 }}>
            {data.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {renderDot(item.color)}
                    <Text style={{ color: theme.colors.onSurfaceVariant, fontSize: 12 }}>
                        {item.label || 'Item'}
                    </Text>
                </View>
            ))}
        </View>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>Content Breakdown</Text>

            <View style={styles.chartContainer}>
                <PieChart
                    data={data}
                    donut
                    showGradient
                    sectionAutoFocus
                    radius={90}
                    innerRadius={60}
                    innerCircleColor={theme.colors.surface}
                    centerLabelComponent={() => {
                        return (
                            <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                                <Text
                                    style={{
                                        fontSize: 22,
                                        color: theme.colors.onSurface,
                                        fontWeight: 'bold',
                                    }}>
                                    {totalTime}
                                </Text>
                                <Text
                                    style={{ fontSize: 14, color: theme.colors.onSurfaceVariant }}>
                                    Total
                                </Text>
                            </View>
                        );
                    }}
                />
            </View>
            <LegendComponent />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: Spacing.lg,
        borderRadius: BorderRadius.xl,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: Spacing.lg,
        alignSelf: 'flex-start',
    },
    chartContainer: {
        marginVertical: Spacing.md,
    },
});
