/**
 * DayStrip — Horizontal scrollable 30-day strip for Khatma
 * Uses the app's primary color scheme
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Spacing, BorderRadius } from '../../theme/DesignSystem';

interface DayStripProps {
    currentDay: number;
    completedJuz: number[];
    selectedDay: number;
    onSelectDay: (day: number) => void;
}

export const DayStrip: React.FC<DayStripProps> = ({
    currentDay,
    completedJuz,
    selectedDay,
    onSelectDay,
}) => {
    const theme = useTheme();
    const flatListRef = useRef<FlatList>(null);
    const days = Array.from({ length: 30 }, (_, i) => i + 1);

    // Auto-scroll to current day on mount
    useEffect(() => {
        const timer = setTimeout(() => {
            const scrollIndex = Math.max(0, currentDay - 3);
            flatListRef.current?.scrollToIndex({
                index: Math.min(scrollIndex, 27),
                animated: true,
            });
        }, 300);
        return () => clearTimeout(timer);
    }, [currentDay]);

    const getDayState = (day: number) => {
        const isCompleted = completedJuz.includes(day);
        const isCurrent = day === currentDay;
        const isSelected = day === selectedDay;
        const isPast = day < currentDay;
        return { isCompleted, isCurrent, isSelected, isPast };
    };

    const renderDay = ({ item: day }: { item: number }) => {
        const { isCompleted, isCurrent, isSelected, isPast } = getDayState(day);

        return (
            <Pressable
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectDay(day);
                }}
                style={({ pressed }) => [
                    styles.dayCircle,
                    {
                        backgroundColor: isCompleted
                            ? theme.colors.primary
                            : isSelected
                                ? theme.colors.primaryContainer
                                : 'transparent',
                        borderWidth: isCurrent && !isCompleted ? 2 : 0,
                        borderColor: theme.colors.primary,
                        opacity: !isPast && !isCurrent && !isCompleted ? 0.5 : 1,
                    },
                    pressed && { transform: [{ scale: 0.9 }] },
                ]}
            >
                {isCompleted ? (
                    <Ionicons name="checkmark" size={16} color="#FFF" />
                ) : (
                    <Text
                        style={[
                            styles.dayText,
                            {
                                color: isSelected
                                    ? theme.colors.primary
                                    : isCurrent
                                        ? theme.colors.primary
                                        : theme.colors.onSurfaceVariant,
                                fontWeight: isCurrent || isSelected ? '700' : '500',
                            },
                        ]}
                    >
                        {day}
                    </Text>
                )}
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                Day {currentDay} of 30
            </Text>
            <FlatList
                ref={flatListRef}
                data={days}
                renderItem={renderDay}
                keyExtractor={(item) => `day-${item}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                onScrollToIndexFailed={() => { }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: Spacing.sm,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: Spacing.sm,
        marginLeft: Spacing.sm,
    },
    listContent: {
        paddingHorizontal: Spacing.sm,
        gap: 8,
    },
    dayCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayText: {
        fontSize: 14,
    },
});
