import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LineChart } from 'react-native-gifted-charts';
import { Spacing, BorderRadius, Shadows, Gradients } from '../../theme/DesignSystem';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

interface ActivityChartProps {
    data: { value: number; label: string }[];
}

export const ActivityChart: React.FC<ActivityChartProps> = ({ data }) => {
    const theme = useTheme();

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
            <View style={styles.header}>
                <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                    Weekly Activity
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Minutes spent reading/listening
                </Text>
            </View>

            <View style={styles.chartContainer}>
                <LineChart
                    areaChart
                    curved
                    data={data}
                    height={180}
                    width={width - Spacing.lg * 4} // adjust width based on padding
                    spacing={40}
                    initialSpacing={20}
                    color1={theme.colors.primary}
                    startFillColor1={theme.colors.primary}
                    endFillColor1={theme.colors.primary}
                    startOpacity={0.3}
                    endOpacity={0.05}
                    noOfSections={4}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    yAxisTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                    hideRules
                    hideDataPoints={false}
                    dataPointsColor={theme.colors.primary}
                    dataPointsRadius={4}
                    thickness={3}
                    isAnimated
                    animationDuration={1200}
                    pointerConfig={{
                        pointerStripHeight: 160,
                        pointerStripColor: theme.colors.onSurfaceVariant,
                        pointerStripWidth: 2,
                        pointerColor: theme.colors.primary,
                        radius: 6,
                        pointerLabelWidth: 100,
                        pointerLabelHeight: 90,
                        activatePointersOnLongPress: true,
                        autoAdjustPointerLabelPosition: false,
                        pointerLabelComponent: (items: { value: number; label: string }[]) => {
                            return (
                                <View
                                    style={{
                                        height: 90,
                                        width: 100,
                                        justifyContent: 'center',
                                        marginTop: -30,
                                        marginLeft: -40,
                                    }}>
                                    <Text
                                        style={{
                                            color: theme.colors.onSurface,
                                            fontSize: 14,
                                            marginBottom: 6,
                                            textAlign: 'center',
                                        }}>
                                        {items[0].value} mins
                                    </Text>
                                    <View
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 6,
                                            borderRadius: 16,
                                            backgroundColor: theme.colors.surfaceVariant,
                                        }}>
                                        <Text
                                            style={{
                                                fontWeight: 'bold',
                                                textAlign: 'center',
                                                color: theme.colors.onSurfaceVariant,
                                            }}>
                                            {items[0].label}
                                        </Text>
                                    </View>
                                </View>
                            );
                        },
                    }}
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
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
    },
    chartContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: -10, // Alignment fix for y-axis labels
    },
});
