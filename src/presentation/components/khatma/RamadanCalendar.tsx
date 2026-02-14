/**
 * RamadanCalendar — Compact collapsible calendar
 * Shows a Headspace-style weekly strip by default, expandable to full month grid
 *
 * Circle color legend:
 *   ✅ Green filled     = Completed (Juz done)
 *   🟠 Gold border      = In progress (some pages read)
 *   🟣 Purple filled    = Today's Juz
 *   ⬜ Light gray       = Future (not yet reached)
 *   🔴 Red-ish tint     = Missed (past, not completed)
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

// Clear, semantically meaningful color palette
const STATUS_COLORS = {
    completed: '#10B981',       // Green — done ✓
    completedBg: '#10B981',
    inProgress: '#F5A623',      // Gold — started, not done
    inProgressBg: '#F5A62318',  // Subtle gold wash
    today: '#7C3AED',           // Vibrant purple — today
    todayBg: '#7C3AED',
    missed: '#EF4444',          // Red — missed/behind
    missedBg: '#EF444412',      // Very subtle red wash
    future: '#94A3B8',          // Slate gray — not yet
    futureBg: '#94A3B810',      // Nearly invisible
    selected: '#7C3AED',       // Purple ring for selection
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

        // Determine circle appearance based on status (priority order)
        let backgroundColor: string;
        let borderWidth = 0;
        let borderColor = 'transparent';
        let textColor: string;

        if (isCompleted) {
            backgroundColor = STATUS_COLORS.completedBg;
            textColor = '#FFFFFF';
        } else if (isCurrent) {
            backgroundColor = STATUS_COLORS.todayBg;
            textColor = '#FFFFFF';
        } else if (hasPartial) {
            backgroundColor = STATUS_COLORS.inProgressBg;
            borderWidth = 2;
            borderColor = STATUS_COLORS.inProgress;
            textColor = STATUS_COLORS.inProgress;
        } else if (isPast) {
            backgroundColor = STATUS_COLORS.missedBg;
            textColor = STATUS_COLORS.missed;
        } else {
            // Future
            backgroundColor = STATUS_COLORS.futureBg;
            textColor = STATUS_COLORS.future;
        }

        // Selected state: outer ring (doesn't override status color)
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
                {/* Outer ring for selected state */}
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
                        borderColor: `${STATUS_COLORS.selected}60`,
                    },
                ]}>
                    <View
                        style={[
                            {
                                width: circleSize,
                                height: circleSize,
                                borderRadius: circleSize / 2,
                                alignItems: 'center',
                                justifyContent: 'center',
                                backgroundColor,
                                borderWidth,
                                borderColor,
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
                                    ? STATUS_COLORS.today
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

    // ── Legend items ──
    const renderLegend = () => (
        <View style={styles.legendRow}>
            <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.completed }]} />
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>Done</Text>
            </View>
            <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.today }]} />
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>Today</Text>
            </View>
            <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: STATUS_COLORS.inProgress }]} />
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>Started</Text>
            </View>
            <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: STATUS_COLORS.missedBg, borderWidth: 1, borderColor: `${STATUS_COLORS.missed}30` }]} />
                <Text style={[styles.legendText, { color: theme.colors.onSurfaceVariant }]}>Missed</Text>
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
                        <View style={[styles.countBadge, { backgroundColor: `${STATUS_COLORS.completed}18` }]}>
                            <Text style={[styles.countText, { color: STATUS_COLORS.completed }]}>
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

                {/* Color Legend */}
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
        gap: Spacing.md,
        marginTop: Spacing.sm,
        paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: '#00000010',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        fontSize: 10,
        fontWeight: '500',
    },
});

