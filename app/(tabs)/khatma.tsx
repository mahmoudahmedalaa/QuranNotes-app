/**
 * Khatma Tab Screen
 * Shows the full completion tracker with calendar and progress.
 * Uses warm accent colors (gold, green) for progress/achievement, purple for primary actions.
 */
import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, Pressable } from 'react-native';
import { Text, Surface, Card, ProgressBar, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useKhatma } from '../../src/infrastructure/khatma/KhatmaContext';
import { getJuzForDay } from '../../src/data/khatmaData';
import { ProgressRing } from '../../src/presentation/components/khatma/ProgressRing';
import { RamadanCalendar } from '../../src/presentation/components/khatma/RamadanCalendar';
import { TodayReadingCard } from '../../src/presentation/components/khatma/TodayReadingCard';
import { CatchUpBanner } from '../../src/presentation/components/khatma/CatchUpBanner';
import { StreakBadge } from '../../src/presentation/components/khatma/StreakBadge';

// Lazy-load celebration modal
const KhatmaCelebrationModal = React.lazy(() =>
    import('../../src/presentation/components/khatma/KhatmaCelebrationModal').then(m => ({
        default: m.KhatmaCelebrationModal,
    }))
);
import {
    Spacing,
    Gradients,
    Shadows,
    BorderRadius,
} from '../../src/presentation/theme/DesignSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Warm accent palette — alpha-channel for dark mode compatibility
const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
    green: '#10B981',
    greenLight: '#10B98120',
};

// ─── Active Khatma Tracker View ───────────────────────────────────────────

function ActiveTrackerView() {
    const theme = useTheme();
    const {
        completedJuz,
        isComplete,
        totalPagesRead,
        currentDay,
        catchUp,
        todayReading,
        getJuzProgress,
        toggleJuz,
        streakDays,
        currentRound,
        completedRounds,
        startNextRound,
        khatmaDay,
        isTrialExpired,
    } = useKhatma();

    const [selectedDay, setSelectedDay] = useState(khatmaDay || 1);
    const [showCelebration, setShowCelebration] = useState(false);
    const celebrationDismissedRef = useRef(false);
    const prevCompletedCountRef = useRef(completedJuz.length);
    const selectedJuz = useMemo(() => getJuzForDay(selectedDay), [selectedDay]);
    const selectedProgress = useMemo(() => getJuzProgress(selectedDay), [selectedDay, getJuzProgress]);
    const daysAhead = Math.max(0, completedJuz.length - (khatmaDay || 0));

    // Get current month name
    const monthName = new Date().toLocaleString('en-US', { month: 'long' });
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - currentDay;

    // Trigger celebration every time completed count transitions to 30
    useEffect(() => {
        const wasComplete = prevCompletedCountRef.current >= 30;
        const nowComplete = completedJuz.length >= 30;
        prevCompletedCountRef.current = completedJuz.length;

        if (nowComplete && !wasComplete) {
            celebrationDismissedRef.current = false;
            setShowCelebration(true);
        }
    }, [completedJuz.length]);

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.activeContent}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Header — single compact row ── */}
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
                            {isComplete && (
                                <Pressable
                                    onPress={() => {
                                        celebrationDismissedRef.current = false;
                                        setShowCelebration(true);
                                    }}
                                    style={({ pressed }) => [
                                        styles.khatmaCountBadge,
                                        { backgroundColor: `${ACCENT.gold}18` },
                                        pressed && { opacity: 0.7 },
                                    ]}
                                >
                                    <MaterialCommunityIcons name="trophy" size={14} color={ACCENT.gold} />
                                    <Text style={[styles.khatmaCountText, { color: ACCENT.gold }]}>
                                        {currentRound}×
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                        <View style={[styles.dayBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                            <MaterialCommunityIcons name="calendar-month" size={14} color={theme.colors.primary} />
                            <Text style={[styles.dayBadgeText, { color: theme.colors.primary }]}>
                                {monthName} · {daysRemaining}d left
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
                    <ProgressRing completed={completedJuz.length} />
                    <CatchUpBanner
                        isAhead={catchUp.isAhead}
                        isBehind={catchUp.isBehind}
                        isComplete={isComplete}
                        message={catchUp.message}
                        todayPagesRead={todayReading?.pagesRead}
                        todayTotalPages={todayReading?.totalPages}
                        completedCount={completedJuz.length}
                    />
                </View>
            </MotiView>

            {/* ── Collapsible Calendar ── */}
            <RamadanCalendar
                currentDay={currentDay}
                completedJuz={completedJuz}
                getJuzProgress={getJuzProgress}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
                monthName={monthName}
            />

            {/* ── Today's / Selected Day Reading Card ── */}
            {selectedJuz && (
                <TodayReadingCard
                    juz={selectedJuz}
                    pagesRead={selectedProgress.pagesRead}
                    totalPages={selectedProgress.totalPages}
                    percent={selectedProgress.percent}
                    lastPosition={selectedProgress.lastPosition}
                    isCompleted={completedJuz.includes(selectedJuz.juzNumber)}
                    isToday={selectedDay === khatmaDay}
                    onToggle={() => toggleJuz(selectedJuz.juzNumber)}
                    isTrialExpired={isTrialExpired}
                />
            )}

            {/* ── Celebration Modal ── */}
            {showCelebration && (
                <Suspense fallback={null}>
                    <KhatmaCelebrationModal
                        visible={showCelebration}
                        onDismiss={() => {
                            setShowCelebration(false);
                            celebrationDismissedRef.current = true;
                        }}
                        onStartNextRound={() => {
                            startNextRound();
                            setShowCelebration(false);
                            celebrationDismissedRef.current = true;
                        }}
                        currentRound={currentRound}
                        daysAhead={daysAhead}
                        ramadanDay={currentDay}
                        totalPagesRead={totalPagesRead}
                        completedJuzCount={completedJuz.length}
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


    // ── Active Tracker ──
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
    dayBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: BorderRadius.full,
    },
    dayBadgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    progressSection: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.xs,
    },
    completionBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: BorderRadius.lg,
        marginTop: Spacing.xs,
    },
    completionBadgeText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
    },
});
