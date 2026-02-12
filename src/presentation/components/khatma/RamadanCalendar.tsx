/**
 * RamadanCalendar — Compact collapsible calendar
 * Shows a Headspace-style weekly strip by default, expandable to full month grid
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface RamadanCalendarProps {
    currentDay: number;
    completedJuz: number[];
    getJuzProgress: (juzNumber: number) => { pagesRead: number; totalPages: number; percent: number; isComplete: boolean };
    selectedDay: number;
    onSelectDay: (day: number) => void;
}

// Colors — warm accent palette (alpha-channel for dark mode compatibility)
const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',   // 20% opacity gold — works on any surface
    green: '#10B981',
    greenLight: '#10B98120',  // 20% opacity green
    missed: '#F59E0B',
    missedLight: '#F59E0B18', // subtle amber wash
    future: '#CBD5E1',
};

const COLS = 5;
const ROWS = 6;

export const RamadanCalendar: React.FC<RamadanCalendarProps> = ({
    currentDay,
    completedJuz,
    getJuzProgress,
    selectedDay,
    onSelectDay,
}) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    // ── Week strip (days around currentDay) ──
    const getWeekDays = () => {
        // Show 7 days centered on current day
        let start = Math.max(1, currentDay - 3);
        const end = Math.min(30, start + 6);
        start = Math.max(1, end - 6); // Adjust start if near end
        const days = [];
        for (let i = start; i <= end; i++) days.push(i);
        return days;
    };

    const renderDayCircle = (day: number, size: 'compact' | 'full' = 'compact') => {
        const isCompleted = completedJuz.includes(day);
        const isCurrent = day === currentDay;
        const isSelected = day === selectedDay;
        const isPast = day < currentDay;
        const isFuture = day > currentDay;
        const progress = getJuzProgress(day);
        const hasPartial = progress.pagesRead > 0 && !isCompleted;

        const circleSize = size === 'compact' ? 40 : 36;

        return (
            <Pressable
                key={day}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectDay(day);
                }}
                style={({ pressed }) => [
                    {
                        alignItems: 'center',
                        gap: 3,
                        opacity: pressed ? 0.7 : 1,
                    },
                ]}
            >
                <View
                    style={[
                        {
                            width: circleSize,
                            height: circleSize,
                            borderRadius: circleSize / 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                        },
                        isCompleted && { backgroundColor: ACCENT.green },
                        hasPartial && { backgroundColor: ACCENT.goldLight, borderWidth: 2, borderColor: ACCENT.gold },
                        isCurrent && !isCompleted && !hasPartial && {
                            backgroundColor: `${theme.colors.primary}15`,
                            borderWidth: 2.5,
                            borderColor: theme.colors.primary,
                        },
                        isSelected && !isCurrent && !isCompleted && !hasPartial && {
                            backgroundColor: theme.colors.primaryContainer,
                            borderWidth: 1.5,
                            borderColor: theme.colors.primary,
                        },
                        isPast && !isCompleted && !hasPartial && {
                            backgroundColor: ACCENT.missedLight,
                        },
                        isFuture && !isCompleted && {
                            backgroundColor: `${ACCENT.future}30`,
                        },
                    ]}
                >
                    {isCompleted ? (
                        <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                    ) : (
                        <Text
                            style={[
                                styles.dayNumber,
                                {
                                    color: isCurrent
                                        ? theme.colors.primary
                                        : hasPartial
                                            ? ACCENT.gold
                                            : isPast
                                                ? ACCENT.missed
                                                : isFuture
                                                    ? ACCENT.future
                                                    : theme.colors.onSurface,
                                    fontWeight: isCurrent || isSelected ? '800' : '600',
                                },
                            ]}
                        >
                            {day}
                        </Text>
                    )}
                </View>
                {size === 'compact' && (
                    <Text
                        style={[
                            styles.dayLabel,
                            {
                                color: isCurrent
                                    ? theme.colors.primary
                                    : theme.colors.onSurfaceVariant,
                                fontWeight: isCurrent ? '700' : '400',
                            },
                        ]}
                    >
                        {isCurrent ? 'Today' : `Day`}
                    </Text>
                )}
            </Pressable>
        );
    };

    // ── Full month grid ──
    const renderFullGrid = () => {
        const rows = [];
        for (let r = 0; r < ROWS; r++) {
            const cells = [];
            for (let c = 0; c < COLS; c++) {
                const day = r * COLS + c + 1;
                if (day <= 30) {
                    cells.push(renderDayCircle(day, 'full'));
                } else {
                    cells.push(<View key={`empty-${c}`} style={{ width: 36 }} />);
                }
            }
            rows.push(
                <View key={r} style={styles.gridRow}>
                    {cells}
                </View>
            );
        }
        return rows;
    };

    const weekDays = getWeekDays();
    const completedCount = completedJuz.length;

    return (
        <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, delay: 100 }}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                {/* Header with toggle */}
                <Pressable onPress={toggleExpand} style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>
                            Ramadan Journey
                        </Text>
                        <View style={[styles.countBadge, { backgroundColor: ACCENT.greenLight }]}>
                            <Text style={[styles.countText, { color: ACCENT.green }]}>
                                {completedCount}/30 days
                            </Text>
                        </View>
                    </View>
                    <MaterialCommunityIcons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={22}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Pressable>

                {/* Compact: Weekly strip */}
                {!expanded && (
                    <View style={styles.weekStrip}>
                        {weekDays.map(day => renderDayCircle(day, 'compact'))}
                    </View>
                )}

                {/* Expanded: Full 30-day grid */}
                {expanded && (
                    <View style={styles.fullGrid}>
                        {renderFullGrid()}
                    </View>
                )}
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginHorizontal: Spacing.xs,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    countBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    countText: {
        fontSize: 12,
        fontWeight: '700',
    },
    weekStrip: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
    },
    dayNumber: {
        fontSize: 14,
    },
    dayLabel: {
        fontSize: 10,
    },
    fullGrid: {
        gap: Spacing.sm,
        paddingVertical: Spacing.xs,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
});
