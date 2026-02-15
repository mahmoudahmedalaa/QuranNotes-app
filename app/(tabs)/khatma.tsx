/**
 * Khatma Tab Screen — Self-paced Juz tracker
 * "Read the Quran at your own pace. Track which Juz you've finished."
 */
import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useKhatma } from '../../src/infrastructure/khatma/KhatmaContext';
import { getJuzInfo } from '../../src/data/khatmaData';
import { ProgressRing } from '../../src/presentation/components/khatma/ProgressRing';
import { JuzGrid } from '../../src/presentation/components/khatma/JuzGrid';
import { TodayReadingCard } from '../../src/presentation/components/khatma/TodayReadingCard';
import { CatchUpBanner } from '../../src/presentation/components/khatma/CatchUpBanner';
import { StreakBadge } from '../../src/presentation/components/khatma/StreakBadge';
import {
    Spacing,
    Gradients,
    Shadows,
    BorderRadius,
} from '../../src/presentation/theme/DesignSystem';

const KhatmaCelebrationModal = React.lazy(() =>
    import('../../src/presentation/components/khatma/KhatmaCelebrationModal').then(m => ({
        default: m.KhatmaCelebrationModal,
    }))
);

const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
    green: '#10B981',
    greenLight: '#10B98120',
};

const CELEBRATION_SHOWN_KEY = 'khatma_celebration_shown_round';

// ─── Active Khatma Tracker View ───────────────────────────────────────────

function ActiveTrackerView() {
    const theme = useTheme();
    const {
        completedJuz,
        isComplete,
        totalPagesRead,
        toggleJuz,
        streakDays,
        currentRound,
        completedRounds,
        startNextRound,
        isTrialExpired,
        loading,
    } = useKhatma();

    const [selectedJuz, setSelectedJuz] = useState(1);
    const [showCelebration, setShowCelebration] = useState(false);
    const selectedJuzInfo = useMemo(() => getJuzInfo(selectedJuz), [selectedJuz]);

    // Refresh key — incremented on tab focus so JuzGrid + TodayReadingCard re-check positions
    const [refreshKey, setRefreshKey] = useState(0);
    useFocusEffect(
        useCallback(() => {
            setRefreshKey(k => k + 1);
        }, []),
    );

    // ── Celebration trigger ──
    const triggerCelebrationIfNeeded = useCallback(async () => {
        if (!isComplete || loading) return;
        try {
            const shownForRound = await AsyncStorage.getItem(CELEBRATION_SHOWN_KEY);
            if (shownForRound !== String(currentRound)) {
                setShowCelebration(true);
            }
        } catch {
            setShowCelebration(true);
        }
    }, [isComplete, currentRound, loading]);

    // Detect in-session completion
    const prevCompletedCountRef = useRef<number | null>(null);
    useEffect(() => {
        if (loading) return;
        const prev = prevCompletedCountRef.current;
        prevCompletedCountRef.current = completedJuz.length;
        if (prev === null) return;
        if (completedJuz.length >= 30 && prev < 30) {
            setShowCelebration(true);
        }
    }, [completedJuz.length, loading]);

    // Fallback: check on tab focus
    useFocusEffect(
        useCallback(() => {
            triggerCelebrationIfNeeded();
        }, [triggerCelebrationIfNeeded]),
    );

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.activeContent}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Header ── */}
            <MotiView
                from={{ opacity: 0, translateY: -10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 18 }}
            >
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <View style={styles.headerLeftGroup}>
                            <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
                                ختمة
                            </Text>
                            {streakDays > 0 && (
                                <StreakBadge streakDays={streakDays} />
                            )}
                        </View>
                        <View style={[styles.progressBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                            <MaterialCommunityIcons name="book-open-variant" size={14} color={theme.colors.primary} />
                            <Text style={[styles.progressBadgeText, { color: theme.colors.primary }]}>
                                {completedJuz.length} of 30 Juz
                            </Text>
                        </View>
                    </View>
                </View>
            </MotiView>

            {/* ── Progress Ring + Status ── */}
            <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 18, delay: 100 }}
            >
                <View style={[styles.progressSection, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                    {/* Trophy badge — shows when user has completed at least one full Khatma */}
                    {(isComplete || completedRounds.length > 0) && (
                        <MotiView
                            from={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', damping: 12, delay: 400 }}
                            style={styles.trophyBadgeCorner}
                        >
                            <Pressable
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                    setShowCelebration(true);
                                }}
                                style={({ pressed }) => [
                                    styles.trophyBadge,
                                    {
                                        backgroundColor: ACCENT.gold,
                                        ...Shadows.md,
                                    },
                                    pressed && { transform: [{ scale: 0.9 }] },
                                ]}
                            >
                                <MaterialCommunityIcons name="trophy" size={16} color="#FFF" />
                                <Text style={styles.trophyText}>
                                    {completedRounds.length + (isComplete ? 1 : 0)}×
                                </Text>
                            </Pressable>
                        </MotiView>
                    )}
                    <View style={styles.ringWrapper}>
                        <ProgressRing completed={completedJuz.length} totalPagesRead={totalPagesRead} />
                    </View>
                    <CatchUpBanner
                        isComplete={isComplete}
                        completedCount={completedJuz.length}
                    />
                </View>
            </MotiView>

            {/* ── Juz Grid ── */}
            <JuzGrid
                completedJuz={completedJuz}
                selectedJuz={selectedJuz}
                onSelectJuz={setSelectedJuz}
                refreshKey={refreshKey}
            />

            {/* ── Selected Juz Reading Card ── */}
            {selectedJuzInfo && (
                <TodayReadingCard
                    juz={selectedJuzInfo}
                    isCompleted={completedJuz.includes(selectedJuzInfo.juzNumber)}
                    isToday={false}
                    onToggle={() => toggleJuz(selectedJuzInfo.juzNumber)}
                    isTrialExpired={isTrialExpired}
                    refreshKey={refreshKey}
                />
            )}

            {/* ── Celebration Modal ── */}
            {showCelebration && (
                <Suspense fallback={null}>
                    <KhatmaCelebrationModal
                        visible={showCelebration}
                        onDismiss={() => {
                            setShowCelebration(false);
                            AsyncStorage.setItem(CELEBRATION_SHOWN_KEY, String(currentRound));
                        }}
                        onStartNextRound={() => {
                            // Save celebration_shown for the NEXT round (currentRound + 1)
                            // because startNextRound() increments currentRound
                            const nextRound = currentRound + 1;
                            startNextRound();
                            setShowCelebration(false);
                            AsyncStorage.setItem(CELEBRATION_SHOWN_KEY, String(nextRound));
                        }}
                        currentRound={currentRound}
                        totalPagesRead={totalPagesRead}
                        completedJuzCount={completedJuz.length}
                        streakDays={streakDays}
                    />
                </Suspense>
            )}
        </ScrollView>
    );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function KhatmaScreen() {
    const theme = useTheme();
    const isDark = theme.dark;
    const gradientColors: [string, string] = isDark
        ? [Gradients.nightSky[0], Gradients.nightSky[1]]
        : [Gradients.sereneSky[0], Gradients.sereneSky[1]];

    return (
        <LinearGradient colors={gradientColors} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <ActiveTrackerView />
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1 },
    scrollView: { flex: 1 },
    activeContent: {
        padding: Spacing.md,
        paddingBottom: 120,
        gap: Spacing.md,
    },
    header: {
        paddingHorizontal: Spacing.xs,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeftGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    khatmaCountBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    khatmaCountText: {
        fontSize: 13,
        fontWeight: '700',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    progressBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    progressBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    progressSection: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.xs,
        position: 'relative' as const,
    },
    ringWrapper: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    trophyBadgeCorner: {
        position: 'absolute' as const,
        top: Spacing.sm,
        right: Spacing.sm,
        zIndex: 10,
    },
    trophyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    trophyText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '800',
    },
});
