/**
 * Khatma Tab Screen
 * Shows a countdown before Ramadan, and the full tracker during Ramadan.
 * Uses warm accent colors (gold, green) for progress/achievement, purple for primary actions.
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, Surface, Card, ProgressBar, useTheme } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useKhatma } from '../../src/infrastructure/khatma/KhatmaContext';
import { useSettings } from '../../src/infrastructure/settings/SettingsContext';
import { getJuzForDay, getDailyMessage } from '../../src/data/khatmaData';
import { daysUntilRamadan, ramadanCountdownText, isPostRamadan } from '../../src/utils/ramadanUtils';
import { ProgressRing } from '../../src/presentation/components/khatma/ProgressRing';
import { RamadanCalendar } from '../../src/presentation/components/khatma/RamadanCalendar';
import { TodayReadingCard } from '../../src/presentation/components/khatma/TodayReadingCard';
import { CatchUpBanner } from '../../src/presentation/components/khatma/CatchUpBanner';
import { KhatmaCelebrationModal } from '../../src/presentation/components/khatma/KhatmaCelebrationModal';
import { StreakBadge } from '../../src/presentation/components/khatma/StreakBadge';
import { PostRamadanSummaryView } from '../../src/presentation/components/khatma/PostRamadanSummaryView';
import { EidCelebrationOverlay } from '../../src/presentation/components/khatma/EidCelebrationOverlay';
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

// ─── Pre-Ramadan Countdown View ─────────────────────────────────────────────

function PreRamadanView() {
    const theme = useTheme();
    const days = daysUntilRamadan();

    const features = [
        {
            icon: 'book-open-page-variant' as const,
            title: 'Complete the Quran in 30 days',
            desc: 'Read 1 Juz per day during Ramadan with smart progress tracking',
        },
        {
            icon: 'bookmark-check' as const,
            title: 'Automatic Progress Tracking',
            desc: 'Your reading is tracked automatically — just read and we handle the rest',
        },
        {
            icon: 'chart-line' as const,
            title: 'Smart catch-up if you fall behind',
            desc: 'Dynamic daily targets recalculate automatically',
        },
    ];

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.preContent}
            showsVerticalScrollIndicator={false}
        >
            {/* ── Title ── */}
            <MotiView
                from={{ opacity: 0, translateY: -20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 18 }}
            >
                <Text variant="displaySmall" style={[styles.preTitle, { color: theme.colors.onBackground }]}>
                    ختمة
                </Text>
                <Text variant="bodyLarge" style={[styles.preSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Quran Completion Tracker
                </Text>
            </MotiView>

            {/* ── Countdown Card ── */}
            <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 15, stiffness: 80, delay: 200 }}
            >
                <Surface
                    style={[styles.countdownSurface, { backgroundColor: theme.colors.surface }]}
                    elevation={2}
                >
                    <Text variant="displayLarge" style={[styles.countdownNumber, { color: ACCENT.gold }]}>
                        {days}
                    </Text>
                    <Text variant="titleMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: -4 }}>
                        {days === 1 ? 'day' : 'days'}
                    </Text>
                    <Text variant="bodyMedium" style={[styles.untilText, { color: theme.colors.onSurfaceVariant }]}>
                        until Ramadan begins
                    </Text>

                    <ProgressBar
                        progress={Math.max(0, Math.min(1, 1 - days / 30))}
                        color={ACCENT.gold}
                        style={styles.countdownProgress}
                    />
                </Surface>
            </MotiView>

            {/* ── Verse ── */}
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 600, delay: 400 }}
            >
                <View style={styles.verseContainer}>
                    <Text style={[styles.verseArabic, { color: theme.colors.onBackground }]}>
                        شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ
                    </Text>
                    <Text style={[styles.verseEnglish, { color: theme.colors.onSurfaceVariant }]}>
                        "Ramadan — the month in which the Quran was revealed"
                    </Text>
                    <Text style={[styles.verseRef, { color: theme.colors.outline }]}>
                        Al-Baqarah 2:185
                    </Text>
                </View>
            </MotiView>

            {/* ── Feature Cards ── */}
            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 18, delay: 500 }}
            >
                <Text variant="titleMedium" style={[styles.sectionLabel, { color: theme.colors.onBackground }]}>
                    What's coming
                </Text>
                {features.map((feature, i) => (
                    <Card
                        key={i}
                        style={[styles.featureCard, { backgroundColor: theme.colors.surface }]}
                        mode="elevated"
                    >
                        <Card.Title
                            title={feature.title}
                            subtitle={feature.desc}
                            titleStyle={styles.featureTitle}
                            subtitleStyle={styles.featureDesc}
                            subtitleNumberOfLines={2}
                            left={(props) => (
                                <View style={[styles.featureIconWrap, { backgroundColor: ACCENT.goldLight }]}>
                                    <MaterialCommunityIcons
                                        name={feature.icon}
                                        size={22}
                                        color={ACCENT.gold}
                                    />
                                </View>
                            )}
                        />
                    </Card>
                ))}
            </MotiView>
        </ScrollView>
    );
}

// ─── Active Ramadan Tracker View ─────────────────────────────────────────────

function ActiveTrackerView() {
    const theme = useTheme();
    const {
        completedJuz,
        isComplete,
        totalPagesRead,
        ramadanDay,
        isRamadanActive,
        catchUp,
        todayReading,
        getJuzProgress,
        toggleJuz,
        streakDays,
        currentRound,
        completedRounds,
    } = useKhatma();
    const { settings } = useSettings();

    const [selectedDay, setSelectedDay] = useState(ramadanDay || 1);
    const [showCelebration, setShowCelebration] = useState(false);
    const celebrationDismissedRef = useRef(false);
    const selectedJuz = useMemo(() => getJuzForDay(selectedDay), [selectedDay]);
    const selectedProgress = useMemo(() => getJuzProgress(selectedDay), [selectedDay, getJuzProgress]);
    const dailyMessage = useMemo(() => getDailyMessage(ramadanDay || 1), [ramadanDay]);
    const daysAhead = Math.max(0, completedJuz.length - (ramadanDay || 0));

    // Trigger celebration when Khatma is first completed (once per session)
    useEffect(() => {
        if (isComplete && !showCelebration && !celebrationDismissedRef.current) {
            setShowCelebration(true);
        }
    }, [isComplete]);

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
                    <View>
                        <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
                            ختمة
                        </Text>
                        <Text style={[styles.headerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Day {ramadanDay} of 30
                        </Text>
                    </View>
                    <View style={[styles.dayBadge, { backgroundColor: theme.colors.primaryContainer }]}>
                        <MaterialCommunityIcons name="moon-waning-crescent" size={14} color={theme.colors.primary} />
                        <Text style={[styles.dayBadgeText, { color: theme.colors.primary }]}>
                            {ramadanCountdownText(settings.debugSimulateRamadan, settings.debugRamadanDay)}
                        </Text>
                    </View>
                </View>
                {/* Streak Badge */}
                {streakDays > 0 && (
                    <StreakBadge streakDays={streakDays} />
                )}
            </MotiView>

            {/* ── Motivational Text — big, breathing, standalone ── */}
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 500, delay: 100 }}
            >
                <View style={styles.motivationContainer}>
                    <Text style={[styles.motivationArabic, { color: theme.colors.onBackground }]}>
                        {dailyMessage.arabic}
                    </Text>
                    <Text style={[styles.motivationEnglish, { color: theme.colors.onSurfaceVariant }]}>
                        {dailyMessage.english}
                    </Text>
                </View>
            </MotiView>

            {/* ── Progress Ring + Stats ── */}
            <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 18, delay: 150 }}
            >
                <View style={[styles.progressSection, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                    <ProgressRing completed={completedJuz.length} />
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: ACCENT.gold }]}>
                                {totalPagesRead}
                            </Text>
                            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Pages Read
                            </Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
                                {catchUp.remainingJuz} Juz
                            </Text>
                            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Left to Go
                            </Text>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: theme.colors.outlineVariant }]} />
                        <View style={styles.statItem}>
                            <Text style={[styles.statNumber, { color: ACCENT.green }]}>
                                {catchUp.dailyTarget < 1 ? '<1' : `~${Math.round(catchUp.dailyTarget)}`} Juz
                            </Text>
                            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Daily Goal
                            </Text>
                        </View>
                    </View>
                </View>
            </MotiView>

            {/* ── Catch-Up Status (lightweight text) ── */}
            <CatchUpBanner
                isAhead={catchUp.isAhead}
                isBehind={catchUp.isBehind}
                isComplete={isComplete}
                message={catchUp.message}
                todayPagesRead={todayReading?.pagesRead}
                todayTotalPages={todayReading?.totalPages}
                completedCount={completedJuz.length}
            />

            {/* ── Collapsible Calendar ── */}
            <RamadanCalendar
                currentDay={ramadanDay || 1}
                completedJuz={completedJuz}
                getJuzProgress={getJuzProgress}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
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
                    isToday={selectedDay === ramadanDay}
                    onToggle={() => toggleJuz(selectedJuz.juzNumber)}
                />
            )}

            {/* ── Celebration Modal ── */}
            <KhatmaCelebrationModal
                visible={showCelebration}
                onDismiss={() => {
                    setShowCelebration(false);
                    celebrationDismissedRef.current = true;
                }}
                currentRound={currentRound}
                daysAhead={daysAhead}
                ramadanDay={ramadanDay || 30}
                totalPagesRead={totalPagesRead}
                completedJuzCount={completedJuz.length}
            />
        </ScrollView>
    );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function KhatmaScreen() {
    const theme = useTheme();
    const { isRamadanActive, isComplete, completedJuz, totalPagesRead, streakDays, currentRound } = useKhatma();
    const postRamadan = isPostRamadan();

    const isDark = theme.dark;
    const gradientColors: [string, string] = isDark
        ? [Gradients.nightSky[0], Gradients.nightSky[1]]
        : [Gradients.sereneSky[0], Gradients.sereneSky[1]];

    const renderContent = () => {
        if (postRamadan) {
            return (
                <>
                    <PostRamadanSummaryView
                        completedJuzCount={completedJuz.length}
                        totalPagesRead={totalPagesRead}
                        streakDays={streakDays}
                        isComplete={isComplete}
                        currentRound={currentRound}
                    />
                    <EidCelebrationOverlay
                        isComplete={isComplete}
                        completedJuzCount={completedJuz.length}
                    />
                </>
            );
        }
        if (isRamadanActive) return <ActiveTrackerView />;
        return <PreRamadanView />;
    };

    return (
        <LinearGradient colors={gradientColors} style={styles.gradient}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {renderContent()}
            </SafeAreaView>
        </LinearGradient>
    );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    gradient: { flex: 1 },
    safeArea: { flex: 1 },
    scrollView: { flex: 1 },

    // ── Pre-Ramadan ──
    preContent: {
        padding: Spacing.lg,
        paddingBottom: 120,
        gap: Spacing.xl,
        alignItems: 'center',
    },
    preTitle: {
        fontWeight: '800',
        textAlign: 'center',
    },
    preSubtitle: {
        textAlign: 'center',
        marginTop: 2,
        fontSize: 15,
    },
    countdownSurface: {
        alignItems: 'center',
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        width: SCREEN_WIDTH - Spacing.lg * 2,
    },
    countdownNumber: {
        fontSize: 72,
        fontWeight: '800',
        lineHeight: 80,
    },
    untilText: {
        marginTop: Spacing.sm,
        fontSize: 15,
    },
    countdownProgress: {
        width: '80%',
        height: 6,
        borderRadius: 3,
        marginTop: Spacing.md,
    },
    verseContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
    },
    verseArabic: {
        fontSize: 26,
        lineHeight: 46,
        fontWeight: '600',
        textAlign: 'center',
    },
    verseEnglish: {
        fontSize: 15,
        textAlign: 'center',
        marginTop: Spacing.sm,
        fontStyle: 'italic',
        lineHeight: 22,
    },
    verseRef: {
        fontSize: 12,
        marginTop: Spacing.xs,
    },
    sectionLabel: {
        fontWeight: '700',
        marginBottom: Spacing.xs,
        alignSelf: 'flex-start',
        fontSize: 17,
    },
    featureCard: {
        marginBottom: Spacing.sm,
        borderRadius: BorderRadius.lg,
        width: SCREEN_WIDTH - Spacing.lg * 2,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    featureDesc: {
        fontSize: 13,
        lineHeight: 18,
    },
    featureIconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // ── Active Tracker ──
    activeContent: {
        padding: Spacing.md,
        paddingBottom: 120,
        gap: Spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.xs,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
    },
    headerSubtitle: {
        fontSize: 14,
        marginTop: 2,
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
    motivationContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    motivationArabic: {
        fontSize: 22,
        lineHeight: 38,
        fontWeight: '600',
        textAlign: 'center',
    },
    motivationEnglish: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: 4,
        fontStyle: 'italic',
        lineHeight: 20,
    },
    progressSection: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.xs,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.md,
        gap: Spacing.lg,
    },
    statItem: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 2,
    },
    statDivider: {
        width: 1,
        height: 28,
        opacity: 0.3,
    },
});
