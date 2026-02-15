/**
 * MoodInsightWidget — Insights tab widget showing mood check-in history.
 * Clean vertical timeline with illustrations (not emojis) and no pill bubbles.
 */
import React, { useMemo } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MoodType, MOOD_CONFIGS } from '../../../domain/entities/Mood';
import { useMood } from '../../../infrastructure/mood/MoodContext';
import { Spacing, BorderRadius, Shadows, Typography } from '../../theme/DesignSystem';
import { MOOD_ILLUSTRATIONS } from '../../theme/MoodIllustrations';

const MAX_TIMELINE_DAYS = 14;

/** Group mood entries by date and pick the last mood of each day */
function groupByDay(history: { mood: MoodType; timestamp: string }[]) {
    const map = new Map<string, { mood: MoodType; date: Date }>();
    history.forEach((e) => {
        const d = new Date(e.timestamp);
        const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        map.set(key, { mood: e.mood, date: d });
    });
    // Sort most recent first
    return Array.from(map.values())
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, MAX_TIMELINE_DAYS);
}

function formatDate(date: Date): string {
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function MoodInsightWidget() {
    const theme = useTheme();
    const { moodHistory } = useMood();

    const dailyMoods = useMemo(() => groupByDay(moodHistory), [moodHistory]);
    const totalCheckins = moodHistory.length;

    // Frequency map for breakdown
    const moodFrequency = useMemo(() => {
        const freq: Partial<Record<MoodType, number>> = {};
        moodHistory.forEach((entry) => {
            freq[entry.mood] = (freq[entry.mood] || 0) + 1;
        });
        return Object.entries(freq)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5) as [MoodType, number][];
    }, [moodHistory]);

    return (
        <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 200 }}
        >
            <View style={[styles.card, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                        Mood Journey
                    </Text>
                    {totalCheckins > 0 && (
                        <Text style={[styles.countText, { color: theme.colors.onSurfaceVariant }]}>
                            {totalCheckins} {totalCheckins === 1 ? 'check-in' : 'check-ins'}
                        </Text>
                    )}
                </View>

                {dailyMoods.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>
                            Check in with your mood to see your journey here
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* Day-by-day timeline — clean rows, no pill bubbles */}
                        <View style={styles.timeline}>
                            {dailyMoods.map((entry, idx) => {
                                const config = MOOD_CONFIGS[entry.mood];
                                const isLast = idx === dailyMoods.length - 1;

                                return (
                                    <View key={idx} style={styles.timelineRow}>
                                        {/* Date label */}
                                        <View style={styles.dateCol}>
                                            <Text style={[styles.dateLabel, {
                                                color: idx === 0 ? theme.colors.primary : theme.colors.onSurfaceVariant,
                                                fontWeight: idx === 0 ? '700' : '500',
                                            }]}>
                                                {formatDate(entry.date)}
                                            </Text>
                                        </View>

                                        {/* Timeline dot + connector */}
                                        <View style={styles.dotCol}>
                                            <View style={[
                                                styles.dot,
                                                {
                                                    backgroundColor: theme.dark ? config.darkColor : config.color,
                                                },
                                            ]} />
                                            {!isLast && (
                                                <View style={[styles.connector, {
                                                    backgroundColor: `${theme.colors.outline}25`,
                                                }]} />
                                            )}
                                        </View>

                                        {/* Mood illustration + label — clean, no background bubble */}
                                        <View style={styles.moodCol}>
                                            <Image
                                                source={MOOD_ILLUSTRATIONS[entry.mood]}
                                                style={styles.moodIllustration}
                                            />
                                            <Text style={[styles.moodLabel, { color: theme.colors.onSurface }]}>
                                                {config.label}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* Frequency breakdown — compact bar with illustrations */}
                        {moodFrequency.length > 0 && (
                            <View style={styles.freqSection}>
                                <Text style={[styles.freqTitle, { color: theme.colors.onSurfaceVariant }]}>
                                    Most frequent
                                </Text>
                                <View style={styles.freqRow}>
                                    {moodFrequency.map(([mood, count]) => {
                                        const config = MOOD_CONFIGS[mood];
                                        const pct = (count / totalCheckins) * 100;
                                        return (
                                            <View key={mood} style={styles.freqItem}>
                                                <Image
                                                    source={MOOD_ILLUSTRATIONS[mood]}
                                                    style={styles.freqIllustration}
                                                />
                                                <View style={[styles.freqBar, {
                                                    backgroundColor: `${theme.colors.outline}15`,
                                                }]}>
                                                    <View style={[styles.freqFill, {
                                                        width: `${Math.max(pct, 8)}%`,
                                                        backgroundColor: theme.dark ? config.darkColor : config.color,
                                                    }]} />
                                                </View>
                                                <Text style={[styles.freqCount, { color: theme.colors.onSurfaceVariant }]}>
                                                    {count}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}
                    </>
                )}
            </View>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginHorizontal: Spacing.md,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        ...Typography.titleMedium,
        fontWeight: '700',
    },
    countText: {
        ...Typography.caption,
        fontWeight: '500',
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    emptyText: {
        ...Typography.bodyMedium,
        textAlign: 'center',
    },
    timeline: {
        gap: 2,
    },
    timelineRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        minHeight: 44,
    },
    dateCol: {
        width: 72,
        paddingTop: 8,
    },
    dateLabel: {
        fontSize: 12,
    },
    dotCol: {
        width: 24,
        alignItems: 'center',
        paddingTop: 8,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        zIndex: 1,
    },
    connector: {
        width: 2,
        flex: 1,
        minHeight: 20,
        marginTop: 2,
    },
    moodCol: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginLeft: 8,
        paddingVertical: 4,
    },
    moodIllustration: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    moodLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    freqSection: {
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(128,128,128,0.12)',
    },
    freqTitle: {
        fontSize: 12,
        fontWeight: '600',
        marginBottom: Spacing.xs,
    },
    freqRow: {
        gap: 6,
    },
    freqItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    freqIllustration: {
        width: 22,
        height: 22,
        borderRadius: 11,
    },
    freqBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    freqFill: {
        height: '100%',
        borderRadius: 3,
    },
    freqCount: {
        fontSize: 11,
        fontWeight: '600',
        width: 20,
        textAlign: 'right',
    },
});
