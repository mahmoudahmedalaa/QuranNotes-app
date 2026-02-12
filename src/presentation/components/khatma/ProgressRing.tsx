/**
 * ProgressRing — SVG circular progress ring for Khatma
 * Uses warm gold accent for progress, green for completion
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Spacing } from '../../theme/DesignSystem';

// Unified accent colors
const ACCENT = {
    gold: '#F5A623',
    green: '#10B981',
};

interface ProgressRingProps {
    completed: number;
    total?: number;
    size?: number;
    strokeWidth?: number;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
    completed,
    total = 30,
    size = 140,
    strokeWidth = 10,
}) => {
    const theme = useTheme();
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = Math.min(completed / total, 1);
    const strokeDashoffset = circumference * (1 - progress);

    const isComplete = completed >= total;

    return (
        <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 120 }}
        >
            <View style={[styles.container, { width: size, height: size }]}>
                <Svg width={size} height={size} style={styles.svg}>
                    {/* Background circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={theme.colors.surfaceVariant}
                        strokeWidth={strokeWidth}
                        fill="none"
                        opacity={0.4}
                    />
                    {/* Progress arc — gold fill, green when complete */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={isComplete ? ACCENT.green : ACCENT.gold}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={`${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                </Svg>
                <View style={styles.centerContent}>
                    <Text
                        style={[
                            styles.countText,
                            { color: isComplete ? ACCENT.green : ACCENT.gold },
                        ]}
                    >
                        {completed}
                    </Text>
                    <Text style={[styles.labelText, { color: theme.colors.onSurfaceVariant }]}>
                        of {total} Juz
                    </Text>
                    {isComplete && (
                        <Text style={styles.completeEmoji}>🎉</Text>
                    )}
                </View>
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    svg: {
        position: 'absolute',
    },
    centerContent: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 34,
        fontWeight: '800',
    },
    labelText: {
        fontSize: 13,
        fontWeight: '500',
        marginTop: 2,
    },
    completeEmoji: {
        fontSize: 20,
        marginTop: Spacing.xs,
    },
});
