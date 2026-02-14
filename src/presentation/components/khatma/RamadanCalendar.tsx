/**
 * RamadanCalendar — Compact collapsible calendar
 * Headspace/Calm-inspired minimal design: just 3 visual states.
 *
 * Circle states (single-hue system):
 *   ✅ Filled primary    = Completed (Juz done)
 *   🟣 Bold ring         = Today (current Juz)
 *   ⬜ Subtle neutral    = Not yet / future
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

const COLS = 5;
const ROWS = 6;

// Single-hue brand color (primary purple) — all states are variations of this
const PRIMARY = '#7C3AED';

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
        let start = Math.max(1, currentDay - 3);
        const end = Math.min(30, start + 6);
        start = Math.max(1, end - 6);
        const days = [];
        for (let i = start; i <= end; i++) days.push(i);
        return days;
    };

    const renderDayCircle = (day: number, size: 'compact' | 'full' = 'compact') => {
        const isCompleted = completedJuz.includes(day);
        const isCurrent = day === currentDay;
        const isSelected = day === selectedDay;

        const circleSize = size === 'compact' ? 40 : 36;

        // ── 3 simple states ──
        let backgroundColor: string;
        let borderWidth = 0;
        let borderColor = 'transparent';
        let textColor: string;

        if (isCompleted) {
            // ✅ Done — filled primary
            backgroundColor = PRIMARY;
            textColor = '#FFFFFF';
        } else if (isCurrent) {
            // 🟣 Today — outlined ring
            backgroundColor = `${PRIMARY}10`;
            borderWidth = 2.5;
            borderColor = PRIMARY;
            textColor = PRIMARY;
        } else {
            // ⬜ Not yet — subtle neutral
            backgroundColor = `${theme.colors.onSurface}08`;
            textColor = `${theme.colors.onSurface}50`;
        }

        // Selection ring (doesn't override status appearance)
        const showSelectedRing = isSelected && !isCurrent;

        return (
            <Pressable
                key={day}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onSelectDay(day);
                }}
                style={({ pressed }) => [{
                    alignItems: 'center',
                    gap: 3,
                    opacity: pressed ? 0.7 : 1,
                }]}
            >
                <View style={[
                    {
                        width: circleSize + (showSelectedRing ? 6 : 0),
                        height: circleSize + (showSelectedRing ? 6 : 0),
                        borderRadius: (circleSize + 6) / 2,
                        alignItems: 'center',
                        justifyContent: 'center',
                    },
                    showSelectedRing && {
                        borderWidth: 2,
                        borderColor: `${PRIMARY}40`,
                    },
                ]}>
                    <View
                        style={{
                            width: circleSize,
                            height: circleSize,
                            borderRadius: circleSize / 2,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor,
                            borderWidth,
                            borderColor,
                        }}
                    >
                        {isCompleted ? (
                            <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                        ) : (
                            <Text
                                style={[
                                    styles.dayNumber,
                                    {
                                        color: textColor,
                                        fontWeight: isCurrent || isSelected ? '800' : '600',
                                    },
                                ]}
                            >
                                {day}
                            </Text>
                        )}
                    </View>
                </View>
                {size === 'compact' && (
                    <Text
                        style={[
                            styles.dayLabel,
                            {
                                color: isCurrent
                                    ? PRIMARY
                                    : theme.colors.onSurfaceVariant,
                                fontWeight: isCurrent ? '700' : '400',
                            },
                        ]}
                    >
                        {isCurrent ? 'Today' : 'Day'}
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

    // ── Minimal legend — just 2 key states ──
    const renderLegend = () => (
        <View style={styles.legendRow}>
            <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: PRIMARY }]} />
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>Completed</Text>
            </View>
            <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 2, borderColor: PRIMARY }]} />
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>Today</Text>
            </View>
        </View>
    );

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
                        <View style={[styles.countBadge, { backgroundColor: `${PRIMARY}12` }]}>
                            <Text style={[styles.countText, { color: PRIMARY }]}>
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

                {/* Minimal Legend */}
                {renderLegend()}
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
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.lg,
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#00000010',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: 11,
        fontWeight: '500',
    },
});

