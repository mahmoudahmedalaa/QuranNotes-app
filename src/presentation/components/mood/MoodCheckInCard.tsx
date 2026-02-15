/**
 * MoodCheckInCard — Home screen mood selection card.
 * Headspace/Calm-inspired: soft rounded bubbles with custom illustrations + label.
 * Shows as a collapsible card below StreakCounter.
 */
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Dimensions, Image } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MoodType, MOOD_CONFIGS, MOOD_LIST } from '../../../domain/entities/Mood';
import { useMood } from '../../../infrastructure/mood/MoodContext';
import { usePro } from '../../../infrastructure/auth/ProContext';
import { Spacing, BorderRadius, Shadows, Typography } from '../../theme/DesignSystem';
import { MOOD_ILLUSTRATIONS } from '../../theme/MoodIllustrations';
import VerseRecommendationSheet from './VerseRecommendationSheet';
import { MoodVerse } from '../../../domain/entities/Mood';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function MoodCheckInCard() {
    const theme = useTheme();
    const router = useRouter();
    const { isPro } = usePro();
    const { checkIn, canCheckIn, freeUsesRemaining, todayMood, todayVerses, resetToday } = useMood();
    const [selectedVerses, setSelectedVerses] = useState<MoodVerse[]>([]);
    const [sheetVisible, setSheetVisible] = useState(false);
    const [loading, setLoading] = useState(false);

    // If user already checked in today, show their result
    const handleMoodSelect = useCallback(async (mood: MoodType) => {
        if (!canCheckIn) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.push('/paywall?reason=mood');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setLoading(true);

        const verses = await checkIn(mood);
        setLoading(false);

        if (verses) {
            setSelectedVerses(verses);
            setSheetVisible(true);
        }
    }, [canCheckIn, checkIn, router]);

    const handleViewTodayVerses = useCallback(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedVerses(todayVerses);
        setSheetVisible(true);
    }, [todayVerses]);

    return (
        <>
            <MotiView
                from={{ opacity: 0, translateY: 15 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 18, delay: 120 }}
                style={{ paddingHorizontal: Spacing.md, marginBottom: Spacing.sm }}
            >
                <View style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows.sm,
                ]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                            {todayMood ? 'Today\'s Reflection' : 'How are you feeling?'}
                        </Text>
                        {!isPro && !todayMood && freeUsesRemaining === 0 && (
                            <Pressable onPress={() => router.push('/paywall?reason=mood')}>
                                <Text style={[styles.upgradeLink, {
                                    color: theme.colors.primary,
                                }]}>
                                    Upgrade to Pro
                                </Text>
                            </Pressable>
                        )}
                    </View>

                    {todayMood ? (
                        /* Already checked in — show summary */
                        <Pressable
                            onPress={handleViewTodayVerses}
                            style={({ pressed }) => [
                                styles.todaySummary,
                                {
                                    backgroundColor: theme.dark
                                        ? MOOD_CONFIGS[todayMood].darkColor
                                        : MOOD_CONFIGS[todayMood].color,
                                },
                                pressed && { opacity: 0.8 },
                            ]}
                        >
                            <Image
                                source={MOOD_ILLUSTRATIONS[todayMood]}
                                style={styles.todayIllustration}
                            />
                            <View style={styles.todayTextGroup}>
                                <Text style={[styles.todayLabel, { color: theme.colors.onSurface }]}>
                                    {MOOD_CONFIGS[todayMood].label}
                                </Text>
                                <Text style={[styles.todayHint, { color: theme.colors.onSurfaceVariant }]}>
                                    Tap to view your verses
                                </Text>
                            </View>
                        </Pressable>
                    ) : (
                        /* Mood grid */
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.moodGrid}
                        >
                            {MOOD_LIST.map((mood, idx) => {
                                const config = MOOD_CONFIGS[mood];
                                return (
                                    <MotiView
                                        key={mood}
                                        from={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{
                                            type: 'spring',
                                            damping: 14,
                                            delay: 80 + idx * 40,
                                        }}
                                    >
                                        <Pressable
                                            onPress={() => handleMoodSelect(mood)}
                                            disabled={loading}
                                            style={({ pressed }) => [
                                                styles.moodBubble,
                                                {
                                                    backgroundColor: theme.dark
                                                        ? config.darkColor
                                                        : config.color,
                                                },
                                                pressed && {
                                                    transform: [{ scale: 0.9 }],
                                                    opacity: 0.8,
                                                },
                                            ]}
                                        >
                                            <Image
                                                source={MOOD_ILLUSTRATIONS[mood]}
                                                style={styles.moodIllustration}
                                                resizeMode="cover"
                                            />
                                            <Text
                                                style={[
                                                    styles.moodLabel,
                                                    { color: theme.colors.onSurface },
                                                ]}
                                                numberOfLines={1}
                                            >
                                                {config.label}
                                            </Text>
                                        </Pressable>
                                    </MotiView>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
            </MotiView>

            <VerseRecommendationSheet
                visible={sheetVisible}
                verses={selectedVerses}
                mood={todayMood}
                onDismiss={() => setSheetVisible(false)}
            />
        </>
    );
}

const styles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.md,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    title: {
        ...Typography.titleMedium,
    },
    upgradeLink: {
        ...Typography.caption,
        fontWeight: '600',
    },
    moodGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingVertical: Spacing.xs,
        paddingRight: Spacing.md,
    },
    moodBubble: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 80,
        height: 96,
        borderRadius: BorderRadius.lg,
        gap: 4,
        paddingTop: 6,
    },
    moodIllustration: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },
    moodLabel: {
        ...Typography.caption,
        fontWeight: '500',
        textAlign: 'center',
    },
    todaySummary: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.md,
    },
    todayIllustration: {
        width: 60,
        height: 60,
        borderRadius: 30,
    },
    todayTextGroup: {
        flex: 1,
    },
    todayLabel: {
        ...Typography.titleMedium,
    },
    todayHint: {
        ...Typography.caption,
        marginTop: 2,
    },
});
