/**
 * JuzSurahList — Shows all surahs in the current Juz as individual cards.
 * Each card has 3 states: Up Next (primary), In Progress (gold), Completed (green).
 * Replaces the old single SurahReadingCard.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, UIManager } from 'react-native';
import { SwipeableCardStack, type SwipeDirection, type CardProps } from 'react-native-swipeable-card-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ReadingPositionService, ReadingPosition } from '../../quran-reading/infrastructure/ReadingPositionService';
import { useAuth } from '../../auth/infrastructure/AuthContext';
import { SurahMeta, getSurahMeta } from '../data/surahData';
import { getSurahsInJuz } from '../data/khatmaData';
import { Spacing, BorderRadius, Shadows, Typography, BrandTokens } from '../../../core/theme/DesignSystem';

// ─── Colors ─────────────────────────────────────────────────────────────────

const ACCENT = {
    gold: '#F5A623',
    green: '#10B981',
    greenBg: '#ECFDF5',
    greenBgDark: '#064E3B',
    blue: BrandTokens.light.accentPrimary,
    blueBg: '#EEF2FF',
    blueBgDark: '#312E81',
    goldBg: '#FFFBEB',
    goldBgDark: '#451A03',
};

// Gradient pairs for stacked cards
// Light: Near-white start → soft pastel end
// Dark: Rich, layered dark tones with subtle color shifts
const CARD_GRADIENTS_LIGHT: [string, string][] = [
    ['#FFFAF2', '#F0C080'],   // Warm cream → tangerine orange
    ['#FFF5F0', '#F0B8A0'],   // Blush white → warm coral
    ['#F2FAF5', '#A8D8B8'],   // Mint white → leafy sage
    ['#FFF2F6', '#F0A8C0'],   // Pink white → dusty rose
    ['#F0F6FF', '#A8C4F0'],   // Ice white → periwinkle
];

const CARD_GRADIENTS_DARK: [string, string][] = [
    ['#18122B', '#553C7B'],   // Deep indigo → rich purple
    ['#0F1A2E', '#2A5080'],   // Midnight → ocean blue
    ['#0F2318', '#1D6B45'],   // Dark forest → emerald green
    ['#2B1222', '#7B3C60'],   // Dark plum → warm rose
    ['#121828', '#3C5580'],   // Charcoal → twilight blue
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface JuzSurahListProps {
    currentJuz: number;
    displayJuz?: number | null;  // override which Juz to display (from grid tap)
    completedSurahs: number[];
    nextSurahNumber: number;
    onMarkComplete: (surahNumber: number) => void;
    onUnmark: (surahNumber: number) => void;
    isGated: boolean;
    onAdvanceJuz?: () => void;  // callback to advance to next Juz after completion
}

// ─── Individual Surah Card ──────────────────────────────────────────────────

interface SurahCardProps {
    surah: SurahMeta;
    status: 'next' | 'in-progress' | 'completed';
    savedVerse: number | null;
    onStartReading: () => void;
    onContinueReading: () => void;
    onMarkComplete: () => void;
    onStartOver: () => void;
    index: number;
    isDark: boolean;
}

const SurahCard: React.FC<SurahCardProps> = ({
    surah,
    status,
    savedVerse,
    onStartReading,
    onContinueReading,
    onMarkComplete,
    onStartOver,
    index,
    isDark,
}) => {
    const theme = useTheme();

    // ── Completed state — soft gradient card with green accent ──
    if (status === 'completed') {
        return (
            <MotiView
                from={{ opacity: 0, translateX: -8 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'spring', damping: 20, delay: index * 40 }}
            >
                <LinearGradient
                    colors={isDark
                        ? ['#0D2818', '#153A24']
                        : ['#DCFCE7', '#E8FAF0', '#F8FDF9', '#FFFFFF']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.completedCard, Shadows.sm]}
                >
                    <View style={styles.completedContent}>
                        <View style={styles.completedCheckBadge}>
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                        <Text style={[styles.completedEnglish, { color: theme.colors.onSurface }]} numberOfLines={1}>
                            {surah.english}
                        </Text>
                        <Text style={[styles.completedArabic, { color: theme.colors.onSurface + 'B0' }]}>
                            {surah.arabic}
                        </Text>
                        <Pressable
                            onPress={onStartOver}
                            style={({ pressed }) => [
                                styles.startOverButton,
                                pressed && { opacity: 0.6, transform: [{ scale: 0.92 }] },
                            ]}
                        >
                            <MaterialCommunityIcons name="refresh" size={14} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </View>
                </LinearGradient>
            </MotiView>
        );
    }

    // ── Up Next / In Progress — clean elevated card ──
    const isNext = status === 'next';
    const accentColor = isNext ? ACCENT.blue : ACCENT.gold;

    return (
        <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: index * 60 }}
        >
            <View style={[
                styles.activeCard,
                {
                    backgroundColor: isDark ? theme.colors.surface : '#FFFFFF',
                },
                Shadows.md,
            ]}>
                {/* Status badge + verse count */}
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: accentColor + '18' }]}>
                        <View style={[styles.statusDot, { backgroundColor: accentColor }]} />
                        <Text style={[styles.statusText, { color: accentColor }]}>
                            {isNext ? 'UP NEXT' : 'READING'}
                        </Text>
                    </View>
                    <Text style={[styles.versesCount, { color: theme.colors.onSurfaceVariant }]}>
                        {surah.verses} verses
                    </Text>
                </View>

                {/* Surah info — English + Arabic aligned on same row */}
                <View style={styles.surahInfoRow}>
                    <Text style={[styles.surahEnglish, { color: theme.colors.onSurface }]}>
                        {surah.english}
                    </Text>
                    <Text style={[styles.surahArabic, { color: theme.colors.onSurface }]}>
                        {surah.arabic}
                    </Text>
                </View>

                {/* Progress bar (in-progress only) — thinner, elegant */}
                {!isNext && savedVerse !== null && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressInfo}>
                            <Text style={[styles.progressLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Verse {savedVerse} of {surah.verses}
                            </Text>
                            <Text style={[styles.progressPercent, { color: accentColor }]}>
                                {Math.round((savedVerse / surah.verses) * 100)}%
                            </Text>
                        </View>
                        <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                            <View
                                style={[
                                    styles.progressFill,
                                    {
                                        backgroundColor: accentColor,
                                        width: `${Math.min((savedVerse / surah.verses) * 100, 100)}%`,
                                    },
                                ]}
                            />
                        </View>
                    </View>
                )}

                {/* Action buttons — muted tonal fills */}
                <View style={styles.actionsRow}>
                    {!isNext && savedVerse !== null ? (
                        <Pressable
                            onPress={onContinueReading}
                            style={({ pressed }) => [
                                styles.readAction,
                                { backgroundColor: theme.colors.primary },
                                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                            ]}
                        >
                            <Ionicons name="play" size={14} color="#FFFFFF" />
                            <Text style={[styles.readActionText, { color: '#FFFFFF' }]}>Continue</Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            onPress={onStartReading}
                            style={({ pressed }) => [
                                styles.readAction,
                                { backgroundColor: theme.colors.primary },
                                pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                            ]}
                        >
                            <Ionicons name="book-outline" size={14} color="#FFFFFF" />
                            <Text style={[styles.readActionText, { color: '#FFFFFF' }]}>Start Reading</Text>
                        </Pressable>
                    )}

                    <Pressable
                        onPress={onMarkComplete}
                        style={({ pressed }) => [
                            styles.completeAction,
                            pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
                        ]}
                    >
                        <Ionicons name="checkmark-circle-outline" size={16} color={ACCENT.green} />
                    </Pressable>
                </View>
            </View>
        </MotiView>
    );
};

// ─── Stacked Card Renderer (for SwipeableCardStack) ────────────────────────

type StackCardItem = SurahMeta & {
    status: 'next' | 'in-progress';
    savedVerse: number | null;
    stackIndex: number;
};



// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Juz Surah List (wrapper) ───────────────────────────────────────────────

export const JuzSurahList: React.FC<JuzSurahListProps> = ({
    currentJuz,
    displayJuz,
    completedSurahs,
    nextSurahNumber,
    onMarkComplete,
    onUnmark,
    isGated,
    onAdvanceJuz,
}) => {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const isDark = theme.dark;

    // Which Juz to show — user-selected overrides current
    const activeJuz = displayJuz ?? currentJuz;
    const isViewingDifferentJuz = displayJuz != null && displayJuz !== currentJuz;

    // Get all surahs in the active Juz
    const surahNumbers = useMemo(() => getSurahsInJuz(activeJuz), [activeJuz]);
    const surahs = useMemo(() => surahNumbers.map(n => getSurahMeta(n)), [surahNumbers]);
    const completedInJuz = useMemo(
        () => surahNumbers.filter(n => completedSurahs.includes(n)).length,
        [surahNumbers, completedSurahs],
    );

    // Fetch saved reading positions for all surahs in this Juz
    const [positions, setPositions] = useState<Record<number, ReadingPosition | null>>({});

    const loadPositions = useCallback(async () => {
        const result: Record<number, ReadingPosition | null> = {};
        for (const num of surahNumbers) {
            const pos = await ReadingPositionService.get(num, userId);
            result[num] = pos;
        }
        setPositions(result);
    }, [surahNumbers, userId]);

    useFocusEffect(useCallback(() => { loadPositions(); }, [loadPositions]));
    useEffect(() => { loadPositions(); }, [loadPositions]);

    // Determine card status
    const getStatus = (surahNum: number): 'next' | 'in-progress' | 'completed' => {
        if (completedSurahs.includes(surahNum)) return 'completed';
        if (surahNum === nextSurahNumber) {
            const pos = positions[surahNum];
            return pos && pos.verse > 1 ? 'in-progress' : 'next';
        }
        const pos = positions[surahNum];
        return pos && pos.verse > 1 ? 'in-progress' : 'next';
    };

    const handleNav = useCallback((surahNum: number, verse?: number) => {
        if (isGated) {
            router.push('/paywall');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (verse && verse > 1) {
            router.push(`/surah/${surahNum}?verse=${verse}&autoplay=true`);
        } else {
            router.push(`/surah/${surahNum}?autoplay=true`);
        }
    }, [isGated, router]);

    // Track restarted surah so we can bring it to front of stack
    const [restartedSurah, setRestartedSurah] = useState<number | null>(null);

    const handleStartOver = (surahNum: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setRestartedSurah(surahNum);
        onUnmark(surahNum);
        // Reload reading positions so the card shows correct Start/Continue
        loadPositions();
    };

    const handleMarkComplete = useCallback((surahNum: number) => {
        if (isGated) {
            router.push('/paywall');
            return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onMarkComplete(surahNum);
    }, [isGated, router, onMarkComplete]);

    // ── Split surahs into completed (compact rows) vs remaining (card stack) ──
    const completedSurahsList = useMemo(
        () => surahs.filter(s => completedSurahs.includes(s.number)),
        [surahs, completedSurahs],
    );
    const remainingSurahsList = useMemo(
        () => surahs.filter(s => !completedSurahs.includes(s.number)),
        [surahs, completedSurahs],
    );

    // SwipeableCardStack data — build StackCardItem array for remaining surahs
    // If a surah was just restarted, move it to the front of the stack
    const stackData: StackCardItem[] = useMemo(
        () => {
            let ordered = [...remainingSurahsList];
            if (restartedSurah != null) {
                const idx = ordered.findIndex(s => s.number === restartedSurah);
                if (idx > 0) {
                    const [restarted] = ordered.splice(idx, 1);
                    ordered.unshift(restarted);
                }
            }
            return ordered.map((surah, i) => {
                const status = getStatus(surah.number);
                const pos = positions[surah.number];
                const savedVerse = pos && pos.verse > 1 ? pos.verse : null;
                return {
                    ...surah,
                    status: status === 'completed' ? 'next' : status,
                    savedVerse,
                    stackIndex: i,
                };
            });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [remainingSurahsList, positions, completedSurahs, nextSurahNumber, restartedSurah],
    );

    // Swipes state for the card stack — tracks completed surahs as "left" swipes
    const [swipes, setSwipes] = useState<SwipeDirection[]>([]);

    // Reset swipes (and clear restarted flag) when Juz changes or completedSurahs changes
    useEffect(() => {
        setSwipes([]);
    }, [activeJuz, completedSurahs.length]);

    // Clear restartedSurah flag when juz changes (but not on completion count changes,
    // since that's triggered by the restart itself)
    useEffect(() => {
        setRestartedSurah(null);
    }, [activeJuz]);

    // Auto-advance to next juz when all surahs in current juz are complete
    useEffect(() => {
        if (
            completedInJuz === surahNumbers.length &&
            surahNumbers.length > 0 &&
            activeJuz < 30 &&
            onAdvanceJuz &&
            !isGated
        ) {
            const timer = setTimeout(() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onAdvanceJuz();
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [completedInJuz, surahNumbers.length, activeJuz, onAdvanceJuz, isGated]);

    // Handle swipe completion (from gesture or programmatic)
    const handleSwipeEnded = useCallback((item: StackCardItem, _direction: SwipeDirection) => {
        handleMarkComplete(item.number);
    }, [handleMarkComplete]);


    // Render function for the card stack
    const renderStackCard = useCallback((item: CardProps<StackCardItem>) => {
        const pos = positions[item.number];
        const visualPos = item.stackIndex - swipes.length;
        // Assign gradient by surah number (stable identity) — NOT by array index
        // which shifts when cards are removed from remainingSurahsList
        const gradients = isDark ? CARD_GRADIENTS_DARK : CARD_GRADIENTS_LIGHT;
        const gradientPair = gradients[item.number % gradients.length];

        // ── Behind cards: tilted cards peeking from sides like "ears" ──
        if (visualPos > 0) {
            // Alternate left/right: odd peek right, even peek left
            const peekDirection = visualPos % 2 === 1 ? 1 : -1;
            const peekAmount = 20 + (visualPos - 1) * 8; // horizontal offset
            const tiltDeg = peekDirection * (16 + (visualPos - 1) * 7); // more dramatic tilt
            return (
                <LinearGradient
                    colors={gradientPair}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.stackCardInner,
                        {
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            transform: [
                                { translateX: peekDirection * peekAmount },
                                { rotate: `${tiltDeg}deg` },
                            ],
                            zIndex: 10 - visualPos,
                            opacity: 1 - visualPos * 0.12,
                        },
                    ]}
                />
            );
        }

        // ── Front card: gradient inner card with content ──
        return (
            <MotiView
                key={`front-${item.stackIndex}`}
                from={{ opacity: 0.5, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 14, stiffness: 160 }}
                style={{ height: '100%', zIndex: 10 }}
            >
                <LinearGradient
                    colors={gradientPair}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[
                        styles.stackCardInner,
                        Shadows.md,
                    ]}
                >
                    {/* Status badge + verse count */}
                    <View style={styles.cardHeader}>
                        <View style={[styles.statusBadge, {
                            backgroundColor: item.status === 'next' ? (isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF') : ACCENT.gold + '18'
                        }]}>
                            <View style={[styles.statusDot, {
                                backgroundColor: item.status === 'next' ? ACCENT.blue : ACCENT.gold
                            }]} />
                            <Text style={[styles.statusText, {
                                color: item.status === 'next' ? ACCENT.blue : ACCENT.gold
                            }]}>
                                {item.status === 'next' ? 'UP NEXT' : 'READING'}
                            </Text>
                        </View>
                        <Text style={[styles.versesCount, { color: theme.colors.onSurfaceVariant }]}>
                            {item.verses} verses
                        </Text>
                    </View>

                    {/* Surah info — English + Arabic aligned on same row */}
                    <View style={styles.surahInfoRow}>
                        <Text style={[styles.surahEnglish, { color: theme.colors.onSurface }]}>
                            {item.english}
                        </Text>
                        <Text style={[styles.surahArabic, { color: theme.colors.onSurface }]}>
                            {item.arabic}
                        </Text>
                    </View>

                    {/* Progress bar (in-progress only) */}
                    {item.status !== 'next' && item.savedVerse !== null && (
                        <View style={styles.progressSection}>
                            <View style={styles.progressInfo}>
                                <Text style={[styles.progressLabel, { color: theme.colors.onSurfaceVariant }]}>
                                    Verse {item.savedVerse} of {item.verses}
                                </Text>
                                <Text style={[styles.progressPercent, { color: ACCENT.gold }]}>
                                    {Math.round((item.savedVerse / item.verses) * 100)}%
                                </Text>
                            </View>
                            <View style={[styles.progressTrack, { backgroundColor: theme.colors.surfaceVariant }]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            backgroundColor: ACCENT.gold,
                                            width: `${Math.min((item.savedVerse / item.verses) * 100, 100)}%`,
                                        },
                                    ]}
                                />
                            </View>
                        </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actionsRow}>
                        {item.status !== 'next' && item.savedVerse !== null ? (
                            <Pressable
                                onPress={() => handleNav(item.number, pos?.verse)}
                                style={({ pressed }) => [
                                    styles.readAction,
                                    { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF' },
                                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                                ]}
                            >
                                <Ionicons name="play" size={14} color={theme.colors.primary} />
                                <Text style={[styles.readActionText, { color: theme.colors.primary }]}>Continue</Text>
                            </Pressable>
                        ) : (
                            <Pressable
                                onPress={() => handleNav(item.number)}
                                style={({ pressed }) => [
                                    styles.readAction,
                                    { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : '#FFFFFF' },
                                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                                ]}
                            >
                                <Ionicons name="book-outline" size={12} color={theme.colors.primary} />
                                <Text style={[styles.readActionText, { color: theme.colors.primary }]}>Start Reading</Text>
                            </Pressable>
                        )}
                    </View>

                    {/* Swipe hint */}
                    <Text style={[styles.swipeHint, { color: theme.colors.onSurface }]}>
                        Swipe right to complete →
                    </Text>
                </LinearGradient>
            </MotiView>
        );
    }, [isDark, theme, positions, handleNav, swipes.length]);

    return (
        <View style={{ marginTop: 8, marginBottom: 8 }}>
            {/* Section header */}
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ type: 'timing', duration: 300 }}
            >
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionLeft}>
                        <MaterialCommunityIcons name="book-open-variant" size={18} color={theme.colors.primary} />
                        <Text style={[styles.sectionTitle, { color: theme.colors.onBackground }]}>
                            Juz {activeJuz} · Surahs
                        </Text>
                        {isViewingDifferentJuz && (
                            <View style={[styles.browsingBadge, { backgroundColor: `${ACCENT.blue}15` }]}>
                                <Text style={[styles.browsingText, { color: ACCENT.blue }]}>Browsing</Text>
                            </View>
                        )}
                    </View>
                    <View style={[styles.countBadge, { backgroundColor: isDark ? theme.colors.surface : '#FFFFFF' }]}>
                        <Text style={[styles.countText, { color: theme.colors.primary }]}>
                            {completedInJuz} of {surahNumbers.length}
                        </Text>
                    </View>
                </View>
            </MotiView>

            {/* Auto-advance to next juz when all surahs complete */}

            {/* Completed surahs — compact rows */}
            {completedSurahsList.length > 0 && (
                <View style={styles.cardList}>
                    {completedSurahsList.map((surah, i) => (
                        <SurahCard
                            key={surah.number}
                            surah={surah}
                            status="completed"
                            savedVerse={null}
                            index={i}
                            isDark={isDark}
                            onStartReading={() => handleNav(surah.number)}
                            onContinueReading={() => handleNav(surah.number)}
                            onMarkComplete={() => { }}
                            onStartOver={() => handleStartOver(surah.number)}
                        />
                    ))}
                </View>
            )}

            {/* Remaining surahs — stacked card deck */}
            {stackData.length > 0 && (
                <View style={styles.stackContainer}>
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <SwipeableCardStack<StackCardItem>
                            data={stackData}
                            swipes={swipes}
                            renderCard={renderStackCard}
                            keyExtractor={(item) => String(item.number)}
                            onSwipeEnded={handleSwipeEnded}
                            allowedSwipeDirections={['right']}
                            numberOfUnswipedCardsToRender={3}
                            horizontalVelocityValidationThreshold={600}
                            horizontalTranslationValidationThreshold={80}
                            style={styles.stackDeck}
                        />
                    </GestureHandlerRootView>
                </View>
            )}
        </View>
    );
};

// Keep backward compat — single card export (used nowhere now, but safe)
export const SurahReadingCard = JuzSurahList;

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    // ── Section header ──
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.xs,
    },
    sectionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        ...Typography.titleMedium,
        fontWeight: '700',
    },
    countBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    countText: {
        ...Typography.labelMedium,
        fontWeight: '700',
    },

    // ── Card list (completed rows) ──
    cardList: {
        gap: 10,
        marginBottom: Spacing.sm,
    },

    // ── Stacked card container ──
    stackContainer: {
        marginTop: 40,
        marginBottom: Spacing.md,
        overflow: 'visible' as const,
    },
    stackDeck: {
        height: 240,
        overflow: 'visible' as const,
    },
    stackCardInner: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        marginHorizontal: 72,
        overflow: 'hidden',
        shadowColor: '#1A1D21',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.10,
        shadowRadius: 12,
        elevation: 5,
        height: '100%',
        justifyContent: 'space-between',
    },
    swipeHint: {
        fontSize: 10,
        fontWeight: '600',
        textAlign: 'center',
        opacity: 0.7,
        marginTop: 2,
    },
    stackCounter: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 8,
        opacity: 0.5,
    },

    // ── Active card (Up Next / In Progress) — clean elevated surface ──
    activeCard: {
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
        shadowColor: '#1A1D21',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.10,
        shadowRadius: 16,
        elevation: 5,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: BorderRadius.full,
    },
    statusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    statusText: {
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
        textTransform: 'uppercase',
    },
    surahInfoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    surahEnglish: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: -0.3,
        flex: 1,
    },
    versesCount: {
        fontSize: 10,
        fontWeight: '600',
        opacity: 0.6,
    },
    surahArabic: {
        fontSize: 20,
        fontWeight: '600',
        marginLeft: Spacing.sm,
        lineHeight: 28,
    },

    // ── Progress — thinner + info row ──
    progressSection: {
        marginBottom: 8,
    },
    progressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressTrack: {
        height: 3,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 2,
    },
    progressLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    progressPercent: {
        fontSize: 12,
        fontWeight: '700',
    },

    // ── Actions — primary filled CTA + icon-only complete ──
    actionsRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    readAction: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 7,
        paddingHorizontal: 20,
        borderRadius: BorderRadius.full,
        gap: 4,
    },
    readActionText: {
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    completeAction: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: 'rgba(16, 185, 129, 0.10)',
    },
    completeActionText: {
        ...Typography.bodyMedium,
        fontWeight: '600',
    },

    // ── Completed card — compact with green accent strip ──
    completedCard: {
        borderRadius: 14,
        overflow: 'hidden',
    },
    completedContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        gap: 10,
    },
    completedCheckBadge: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#10B981',
        alignItems: 'center',
        justifyContent: 'center',
    },
    completedInfo: {
        flex: 1,
    },
    completedVerseBadge: {
        position: 'absolute' as const,
        top: 6,
        right: 10,
    },
    completedVerseText: {
        fontSize: 10,
        fontWeight: '600',
    },
    completedEnglish: {
        fontSize: 14,
        fontWeight: '700',
        flex: 1,
    },
    completedArabic: {
        fontSize: 18,
        fontWeight: '600',
    },
    startOverButton: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(128,128,128,0.12)',
    },

    // ── Expand/collapse toggle ──
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: BorderRadius.md,
        marginTop: Spacing.xs,
    },
    expandText: {
        ...Typography.bodyMedium,
        fontWeight: '600',
    },

    // ── Browsing badge ──
    browsingBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: BorderRadius.full,
        marginLeft: 4,
    },
    browsingText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },

    // ── Juz completion ──
    juzCompleteCard: {
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    juzCompleteTrophy: {
        marginBottom: Spacing.xs,
    },
    juzCompleteTitle: {
        ...Typography.titleLarge,
        fontWeight: '700',
        marginBottom: 4,
    },
    juzCompleteSubtitle: {
        ...Typography.bodyMedium,
        textAlign: 'center',
    },
    advanceJuzButton: {
        marginTop: Spacing.md,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: BorderRadius.full,
        alignItems: 'center' as const,
    },
    advanceJuzButtonText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700' as const,
        letterSpacing: 0.3,
    },
});
