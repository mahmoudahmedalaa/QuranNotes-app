/**
 * VerseRecommendationSheet — Full-screen modal showing recommended verses.
 * Premium Headspace/Calm-inspired design with:
 *  - Visible frosted close button (white X)
 *  - Inline single-verse audio playback
 *  - "Go to Surah" navigation option
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    Pressable,
    ScrollView,
    Image,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { MoodType, MoodVerse, MOOD_CONFIGS } from '../../../domain/entities/Mood';
import { useAudio } from '../../../infrastructure/audio/AudioContext';
import { useQuran } from '../../hooks/useQuran';
import { Spacing, BorderRadius, Shadows, Typography, Gradients } from '../../theme/DesignSystem';
import { MOOD_ILLUSTRATIONS } from '../../theme/MoodIllustrations';

interface Props {
    visible: boolean;
    verses: MoodVerse[];
    mood: MoodType | null;
    onDismiss: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function VerseRecommendationSheet({
    visible,
    verses,
    mood,
    onDismiss,
}: Props) {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { playVerse, pause, isPlaying, playingVerse, stop } = useAudio();
    const { loadSurah } = useQuran();
    const [loadingVerse, setLoadingVerse] = useState<string | null>(null);

    // Runtime-enriched verses with full text from API
    const [enrichedVerses, setEnrichedVerses] = useState<MoodVerse[]>([]);
    const [loadingText, setLoadingText] = useState(false);

    // Cache to avoid re-fetching surahs we've already loaded
    const surahCacheRef = useRef<Map<number, { text: string; translation: string }[]>>(new Map());

    const moodConfig = mood ? MOOD_CONFIGS[mood] : null;

    // Fetch full verse text when the sheet opens
    useEffect(() => {
        if (!visible || verses.length === 0) {
            setEnrichedVerses([]);
            return;
        }

        let cancelled = false;

        const fetchFullText = async () => {
            setLoadingText(true);

            // Group verses by surah number to minimize API calls
            const surahNumbers = [...new Set(verses.map(v => v.surah))];

            // Fetch only surahs we haven't cached
            const fetchPromises = surahNumbers
                .filter(num => !surahCacheRef.current.has(num))
                .map(async (surahNum) => {
                    try {
                        const surah = await loadSurah(surahNum);
                        if (surah && !cancelled) {
                            const verseMap = surah.verses.map(v => ({
                                text: v.text,
                                translation: v.translation,
                            }));
                            surahCacheRef.current.set(surahNum, verseMap);
                        }
                    } catch {
                        // Silently fail — will fall back to snippet
                    }
                });

            await Promise.all(fetchPromises);

            if (cancelled) return;

            // Enrich verses with full text from cache
            const enriched = verses.map(v => {
                const cachedSurah = surahCacheRef.current.get(v.surah);
                if (cachedSurah && v.verse > 0 && v.verse <= cachedSurah.length) {
                    const fullVerse = cachedSurah[v.verse - 1]; // verse numbers are 1-indexed
                    return {
                        ...v,
                        arabicFull: fullVerse.text,
                        translationFull: fullVerse.translation,
                    };
                }
                return v;
            });

            setEnrichedVerses(enriched);
            setLoadingText(false);
        };

        fetchFullText();

        return () => {
            cancelled = true;
        };
    }, [visible, verses, loadSurah]);

    const handlePlayVerse = useCallback(async (surahNum: number, verseNum: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const verseKey = `${surahNum}:${verseNum}`;

        // If already playing this verse, toggle pause
        if (playingVerse && playingVerse.surah === surahNum && playingVerse.verse === verseNum) {
            if (isPlaying) {
                pause();
            }
            return;
        }

        try {
            setLoadingVerse(verseKey);
            // Stop any existing playback first to prevent conflicts
            await stop();
            await playVerse(surahNum, verseNum);
        } catch (e) {
            if (__DEV__) console.error('[VerseRec] Error playing verse:', e);
        } finally {
            setLoadingVerse(null);
        }
    }, [playVerse, pause, isPlaying, playingVerse, stop]);

    const handleOpenSurah = useCallback((surah: number, verse: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        stop();
        onDismiss();
        router.push(`/surah/${surah}?verse=${verse}&autoplay=true`);
    }, [onDismiss, router, stop]);

    if (!mood || verses.length === 0) return null;

    // Gradient colors based on mood
    const headerGradient: readonly [string, string] = theme.dark
        ? [moodConfig?.darkColor || '#1A1F26', theme.colors.background]
        : [moodConfig?.color || '#F8FAFB', theme.colors.background];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onDismiss}
        >
            <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
                {/* Gradient header */}
                <LinearGradient
                    colors={headerGradient as readonly [string, string]}
                    style={[styles.gradientHeader, { paddingTop: insets.top + Spacing.md }]}
                >
                    {/* Close button — visible frosted glass */}
                    <Pressable
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            stop();
                            onDismiss();
                        }}
                        style={({ pressed }) => [
                            styles.closeButton,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(255,255,255,0.15)'
                                    : 'rgba(0,0,0,0.08)',
                            },
                            pressed && { opacity: 0.6 },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="close"
                            size={20}
                            color={theme.dark ? '#FFFFFF' : '#333333'}
                        />
                    </Pressable>

                    {/* Mood header */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 14, delay: 100 }}
                        style={styles.moodHeader}
                    >
                        {mood && <Image
                            source={MOOD_ILLUSTRATIONS[mood]}
                            style={styles.moodIllustration}
                        />}
                        <Text style={[styles.moodLabel, { color: theme.colors.onSurface }]}>
                            {moodConfig?.label}
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                            Here are some verses for you
                        </Text>
                    </MotiView>
                </LinearGradient>

                {/* Verse cards */}
                <ScrollView
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + Spacing.xl },
                    ]}
                    showsVerticalScrollIndicator={false}
                >
                    {(enrichedVerses.length > 0 ? enrichedVerses : verses).map((verse, idx) => {
                        const verseKey = `${verse.surah}:${verse.verse}`;
                        const isCurrentlyPlaying = playingVerse &&
                            playingVerse.surah === verse.surah &&
                            playingVerse.verse === verse.verse;
                        const isLoading = loadingVerse === verseKey;
                        const displayArabic = verse.arabicFull || verse.arabicSnippet;
                        const displayTranslation = verse.translationFull || verse.translation;

                        return (
                            <MotiView
                                key={`${verse.surah}-${verse.verse}-${idx}`}
                                from={{ opacity: 0, translateY: 20 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                transition={{
                                    type: 'spring',
                                    damping: 16,
                                    delay: 200 + idx * 120,
                                }}
                            >
                                <View style={[
                                    styles.verseCard,
                                    { backgroundColor: theme.colors.surface },
                                    Shadows.sm,
                                ]}>
                                    {/* Arabic text — full verse from API, or snippet fallback */}
                                    <Text style={[styles.arabicText, { color: theme.colors.onSurface }]}>
                                        {displayArabic}
                                    </Text>

                                    {/* Divider */}
                                    <View style={[styles.divider, { backgroundColor: `${theme.colors.outline}30` }]} />

                                    {/* Translation — full from API, or snippet fallback */}
                                    <Text style={[styles.translation, { color: theme.colors.onSurfaceVariant }]}>
                                        {displayTranslation}
                                    </Text>

                                    {/* Theme badge + Actions */}
                                    <View style={styles.verseFooter}>
                                        <View style={[styles.themeBadge, {
                                            backgroundColor: theme.dark ? '#FFFFFF15' : '#00000008',
                                        }]}>
                                            <Text style={[styles.themeText, {
                                                color: theme.colors.onSurfaceVariant,
                                            }]}>
                                                {verse.theme}
                                            </Text>
                                        </View>

                                        <View style={styles.actionButtons}>
                                            {/* Play verse inline */}
                                            <Pressable
                                                onPress={() => handlePlayVerse(verse.surah, verse.verse)}
                                                style={({ pressed }) => [
                                                    styles.playButton,
                                                    {
                                                        backgroundColor: isCurrentlyPlaying && isPlaying
                                                            ? theme.colors.primary
                                                            : theme.dark ? '#FFFFFF15' : '#00000008',
                                                    },
                                                    pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                                                ]}
                                            >
                                                {isLoading ? (
                                                    <ActivityIndicator size={14} color={theme.colors.primary} />
                                                ) : (
                                                    <MaterialCommunityIcons
                                                        name={isCurrentlyPlaying && isPlaying ? 'pause' : 'play'}
                                                        size={16}
                                                        color={isCurrentlyPlaying && isPlaying ? '#FFFFFF' : theme.colors.primary}
                                                    />
                                                )}
                                            </Pressable>

                                            {/* Open in Surah */}
                                            <Pressable
                                                onPress={() => handleOpenSurah(verse.surah, verse.verse)}
                                                style={({ pressed }) => [
                                                    styles.openButton,
                                                    { backgroundColor: theme.colors.primary },
                                                    pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                                                ]}
                                            >
                                                <MaterialCommunityIcons
                                                    name="book-open-page-variant"
                                                    size={14}
                                                    color="#FFFFFF"
                                                />
                                                <Text style={[styles.openButtonText, { color: '#FFFFFF' }]}>
                                                    {verse.surah}:{verse.verse}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                </View>
                            </MotiView>
                        );
                    })}
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradientHeader: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.lg,
    },
    closeButton: {
        alignSelf: 'flex-end',
        width: 36,
        height: 36,
        borderRadius: BorderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    moodHeader: {
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    moodIllustration: {
        width: 72,
        height: 72,
        borderRadius: 36,
        marginBottom: Spacing.xs,
    },
    moodLabel: {
        ...Typography.displayMedium,
        marginBottom: 4,
    },
    subtitle: {
        ...Typography.bodyMedium,
    },
    scrollContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        gap: Spacing.md,
    },
    verseCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    arabicText: {
        fontSize: 22,
        lineHeight: 38,
        textAlign: 'right',
        fontFamily: 'System',
        marginBottom: Spacing.md,
    },
    divider: {
        height: 1,
        marginBottom: Spacing.md,
    },
    translation: {
        ...Typography.bodyLarge,
        fontStyle: 'italic',
        lineHeight: 26,
        marginBottom: Spacing.md,
    },
    verseFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    themeBadge: {
        paddingHorizontal: Spacing.sm + 2,
        paddingVertical: 5,
        borderRadius: BorderRadius.full,
    },
    themeText: {
        fontSize: 12,
        fontWeight: '600' as const,
        textTransform: 'capitalize' as const,
    },
    actionButtons: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 8,
    },
    playButton: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.full,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    openButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 5,
        paddingHorizontal: Spacing.sm + 4,
        paddingVertical: Spacing.xs + 2,
        borderRadius: BorderRadius.full,
    },
    openButtonText: {
        fontSize: 13,
        fontWeight: '600' as const,
    },
});
