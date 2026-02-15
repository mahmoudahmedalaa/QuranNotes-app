import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ViewToken, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, useTheme, FAB } from 'react-native-paper';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useQuran } from '../../src/presentation/hooks/useQuran';
import { useAudio } from '../../src/infrastructure/audio/AudioContext';
import { useAudioRecorder } from '../../src/presentation/hooks/useAudioRecorder';
import { VerseItem } from '../../src/presentation/components/quran/VerseItem';
import { useNotes } from '../../src/presentation/hooks/useNotes';
import { useVoiceFollowAlong } from '../../src/presentation/hooks/useVoiceFollowAlong';
import { WaveBackground } from '../../src/presentation/components/animated/WaveBackground';
import { NoorMascot } from '../../src/presentation/components/mascot/NoorMascot';
import { StickyAudioPlayer } from '../../src/presentation/components/quran/StickyAudioPlayer';
import { RecordingIndicatorBar } from '../../src/presentation/components/recording/RecordingIndicatorBar';
import { RecordingSaveModal } from '../../src/presentation/components/recording/RecordingSaveModal';
import { VoiceFollowAlongOverlay } from '../../src/presentation/components/voice/VoiceFollowAlongOverlay';
import { FollowAlongSaveModal } from '../../src/presentation/components/voice/FollowAlongSaveModal';
import { FollowAlongSession } from '../../src/domain/entities/FollowAlongSession';

import { Verse } from '../../src/domain/entities/Quran';
import { ReadingPositionService, ReadingPosition } from '../../src/infrastructure/reading/ReadingPositionService';
import { KhatmaReadingPosition } from '../../src/infrastructure/khatma/KhatmaReadingPosition';
import { useKhatma } from '../../src/infrastructure/khatma/KhatmaContext';
import { getJuzForSurah, JUZ_DATA } from '../../src/data/khatmaData';

import {
    Spacing,
    Gradients,
    Shadows,
    BorderRadius,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const ACCENT_GOLD = '#D4A853';

export default function SurahDetail() {
    const { id, verse: verseParam, autoplay, page: pageParam } = useLocalSearchParams<{ id: string; verse?: string; autoplay?: string; page?: string }>();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const { surah, loading, error, loadSurah } = useQuran();
    const { playingVerse, isPlaying, playFromVerse, pause, resume, stop, lastCompletedPlayback } = useAudio();
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const { notes } = useNotes();
    const { markJuzComplete, completedJuz } = useKhatma();
    const followAlong = useVoiceFollowAlong(surah?.verses || [], surah?.number, surah?.englishName, surah?.name);

    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
    const [recordingVerseId, setRecordingVerseId] = useState<number | undefined>();
    const [isStudyMode, setIsStudyMode] = useState(false);
    const [followAlongModalVisible, setFollowAlongModalVisible] = useState(false);
    const [completedFollowAlongSession, setCompletedFollowAlongSession] = useState<FollowAlongSession | null>(null);
    const flatListRef = useRef<any>(null);
    const layoutReadyRef = useRef(false);
    const autoplayTriggeredRef = useRef(false);
    // Single scroll controller — all scroll requests go through scrollToVerse()
    const scrollLockRef = useRef(false);
    const scrollLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Track previous playing verse to detect sequential auto-advance vs manual play
    const prevPlayingVerseRef = useRef<{ surah: number; verse: number } | null>(null);
    // Stable ref for surah used inside viewability callback (avoids stale closure)
    const surahRef = useRef(surah);
    useEffect(() => { surahRef.current = surah; }, [surah]);

    // ── Reading position state ──
    const lastVisibleVerseRef = useRef<number>(1);
    const autoScrollEnabledRef = useRef(true);
    const [savedPosition, setSavedPosition] = useState<ReadingPosition | null>(null);
    const [showResumeBanner, setShowResumeBanner] = useState(false);
    const [showReturnToAudio, setShowReturnToAudio] = useState(false);

    useEffect(() => {
        if (id) loadSurah(Number(id));
    }, [id]);

    // ── Compute whether we have a page-based Khatma navigation target ──
    // Used to boost initialNumToRender so the target verse is already measured
    // when the scroll effect fires (prevents the "random start" bug).
    const hasKhatmaTarget = useMemo(() => {
        if (!pageParam || verseParam || !surah?.verses) return false;
        const targetPage = Number(pageParam);
        return !!targetPage;
    }, [pageParam, verseParam, surah]);

    // ── Load saved reading position on mount ──
    // Skip when navigating to a specific verse/page (e.g. from Khatma)
    // so the saved position doesn't override the intended scroll target
    useEffect(() => {
        if (!id) return;
        if (verseParam || pageParam) return; // Don't load saved position when explicit nav params exist
        const surahId = Number(id);
        ReadingPositionService.get(surahId).then(pos => {
            if (pos) {
                setSavedPosition(pos);
                lastVisibleVerseRef.current = pos.verse;
                // Show resume banner only if user has real progress (past verse 1),
                // didn't navigate to a specific verse, and isn't auto-playing
                if (!autoplay && pos.verse > 1) {
                    setShowResumeBanner(true);
                }
            }
        });
    }, [id, verseParam, pageParam]);

    // ── Auto-save reading position on exit + end khatma session ──
    useEffect(() => {
        const surahRef = surah;
        return () => {
            // Save position when unmounting (leaving screen)
            if (surahRef && lastVisibleVerseRef.current > 1) {
                ReadingPositionService.save(
                    surahRef.number,
                    lastVisibleVerseRef.current,
                    surahRef.englishName
                );
            }
            // End any active khatma session so general browsing
            // doesn't continue saving khatma positions
            KhatmaReadingPosition.endSession();
        };
    }, [surah]);

    // ── Also save position when app goes to background ──
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background' || nextState === 'inactive') {
                if (surah && lastVisibleVerseRef.current > 1) {
                    ReadingPositionService.save(
                        surah.number,
                        lastVisibleVerseRef.current,
                        surah.englishName
                    );
                }
            }
        });
        return () => subscription.remove();
    }, [surah]);

    // ═══════════════════════════════════════════════════════════════════════════
    // SINGLE SCROLL CONTROLLER — all scroll requests go through this function.
    // It acquires a lock for 1.5s to prevent any competing scroll.
    // ═══════════════════════════════════════════════════════════════════════════
    const scrollToVerse = useCallback((verseNum: number, animated = true) => {
        if (!surah?.verses || !flatListRef.current || !layoutReadyRef.current) return;
        const index = surah.verses.findIndex((v: Verse) => v.number === verseNum);
        if (index < 0) return;

        // Acquire scroll lock
        scrollLockRef.current = true;
        if (scrollLockTimerRef.current) clearTimeout(scrollLockTimerRef.current);
        scrollLockTimerRef.current = setTimeout(() => {
            scrollLockRef.current = false;
        }, 1500);

        flatListRef.current.scrollToIndex({
            index,
            animated,
            viewPosition: 0.3, // Upper third — less estimation error than centering
        });
    }, [surah]);

    // ── Resume banner handler ──
    const handleResumeBannerPress = useCallback(async () => {
        if (!savedPosition || !surah) return;
        const verseNum = savedPosition.verse;
        await stop();
        scrollToVerse(verseNum);
        setTimeout(() => playFromVerse(surah, verseNum), 700);
        setShowResumeBanner(false);
    }, [savedPosition, surah, playFromVerse, stop, scrollToVerse]);

    // ── Scroll-to-bookmark: verse param from Khatma / Continue Reading ──
    useEffect(() => {
        if (verseParam && surah?.verses) {
            const verseNum = Number(verseParam);
            const tryScroll = () => {
                if (layoutReadyRef.current) {
                    scrollToVerse(verseNum);
                    if (autoplay === 'true' && !autoplayTriggeredRef.current) {
                        autoplayTriggeredRef.current = true;
                        setTimeout(() => playFromVerse(surah, verseNum), 700);
                    }
                } else {
                    setTimeout(tryScroll, 200);
                }
            };
            setTimeout(tryScroll, 300);
        }
    }, [verseParam, surah]);

    // ── Autoplay from verse 1 when no specific verse is given ──
    useEffect(() => {
        if (autoplay === 'true' && !verseParam && !pageParam && surah && !autoplayTriggeredRef.current) {
            autoplayTriggeredRef.current = true;
            setTimeout(() => playFromVerse(surah, 1), 500);
        }
    }, [autoplay, verseParam, pageParam, surah, playFromVerse]);

    // ── Page-based navigation: jump to first verse on the given page (Khatma Juz start) ──
    // Uses aggressive retries to handle the case where FlatList hasn't measured
    // all items yet (long surahs like Al-Baqarah with 286 verses).
    useEffect(() => {
        if (!pageParam || verseParam || !surah?.verses) return;
        const targetPage = Number(pageParam);
        if (!targetPage) return;
        const firstVerseOnPage = surah.verses.find((v: Verse) => v.page >= targetPage);
        if (!firstVerseOnPage) return;
        const verseNum = firstVerseOnPage.number;
        let attempts = 0;
        const tryScroll = () => {
            if (layoutReadyRef.current) {
                scrollToVerse(verseNum, attempts === 0); // animated after first attempt
                if (autoplay === 'true' && !autoplayTriggeredRef.current) {
                    autoplayTriggeredRef.current = true;
                    setTimeout(() => playFromVerse(surah, verseNum), 700);
                }
                // Retry once more after items have been measured to ensure accuracy
                if (attempts < 2) {
                    attempts++;
                    setTimeout(tryScroll, 500);
                }
            } else {
                attempts++;
                if (attempts < 10) setTimeout(tryScroll, 200);
            }
        };
        setTimeout(tryScroll, 300);
    }, [pageParam, verseParam, surah]);

    // ── Auto-scroll to currently playing verse ──
    // ONLY fires on sequential auto-advance (verse N → N+1), NOT on manual play.
    // This prevents the jarring scroll jump when user taps play on a different verse.
    useEffect(() => {
        if (!surah?.verses || !playingVerse || !flatListRef.current) return;
        if (playingVerse.surah !== surah.number) return;
        if (scrollLockRef.current) return; // Another scroll is in progress

        const prev = prevPlayingVerseRef.current;
        prevPlayingVerseRef.current = playingVerse;

        // Only auto-scroll if this is sequential advance (same surah, next verse)
        const isSequentialAdvance = prev &&
            prev.surah === playingVerse.surah &&
            playingVerse.verse === prev.verse + 1;

        if (!isSequentialAdvance) return; // Manual play — don't scroll

        if (!autoScrollEnabledRef.current) {
            setShowReturnToAudio(true);
            return;
        }

        setShowReturnToAudio(false);
        const index = surah.verses.findIndex((v: Verse) => v.number === playingVerse.verse);
        if (index >= 0 && layoutReadyRef.current) {
            flatListRef.current.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.3,
            });
        }
    }, [playingVerse, surah]);

    // ── Reset auto-scroll when audio stops ──
    useEffect(() => {
        if (!playingVerse || !isPlaying) {
            setShowReturnToAudio(false);
            autoScrollEnabledRef.current = true;
        }
    }, [playingVerse, isPlaying]);

    // ── Manual scroll detection — pause auto-scroll ──
    const handleScrollBeginDrag = useCallback(() => {
        if (playingVerse && isPlaying) {
            autoScrollEnabledRef.current = false;
            setShowReturnToAudio(true);
        }
    }, [playingVerse, isPlaying]);

    // ── Return to Audio handler ──
    const handleReturnToAudio = useCallback(() => {
        if (!playingVerse) return;
        scrollToVerse(playingVerse.verse);
        autoScrollEnabledRef.current = true;
        setShowReturnToAudio(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, [playingVerse, scrollToVerse]);

    // ── FlatList scroll error recovery ──
    // Jump to estimated offset instantly (no animation), then do ONE smooth
    // animated scroll to the exact position. This eliminates the double-hop.
    const onScrollToIndexFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
        const offset = info.averageItemLength * info.index;
        // Instant jump — no visible animation
        flatListRef.current?.scrollToOffset({ offset, animated: false });
        // Then settle smoothly into exact position after items are measured
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0.3,
            });
        }, 100);
    }, []);

    // (Khatma page tracking removed — completion is now auto-detected + manual toggle)

    // ── Auto-complete Juz when user reaches the last verse of the last surah in a Juz ──
    const autoCompletedRef = useRef<Set<number>>(new Set());
    const checkAutoCompleteJuz = useCallback((visibleVerseNum: number) => {
        const currentSurah = surahRef.current;
        if (!currentSurah) return;
        const totalVerses = currentSurah.numberOfAyahs;
        if (visibleVerseNum < totalVerses) return; // Haven't reached the end

        const surahNumber = currentSurah.number;
        const juzNumbers = getJuzForSurah(surahNumber);
        for (const juzNum of juzNumbers) {
            if (autoCompletedRef.current.has(juzNum)) continue;
            if (completedJuz.includes(juzNum)) continue;
            const juzInfo = JUZ_DATA.find(j => j.juzNumber === juzNum);
            if (!juzInfo) continue;
            if (surahNumber === juzInfo.endSurahNumber) {
                autoCompletedRef.current.add(juzNum);
                markJuzComplete(juzNum);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
        }
    }, [completedJuz, markJuzComplete]);

    // ── Auto-continue to next surah in Khatma + auto-complete ──
    // When audio finishes the last verse of a surah during a Khatma session,
    // automatically navigate to the next surah in the Juz if it's not the last one.
    useEffect(() => {
        if (!lastCompletedPlayback || !surah) return;
        if (lastCompletedPlayback.surah !== surah.number) return;

        const lastVerseNum = lastCompletedPlayback.verses[lastCompletedPlayback.verses.length - 1]?.number;
        if (!lastVerseNum) return;

        // Check auto-complete first (works regardless of Khatma session)
        checkAutoCompleteJuz(lastVerseNum);

        // Auto-continue to next surah if in a Khatma session
        const activeJuz = KhatmaReadingPosition.getActiveJuz();
        if (!activeJuz) return; // Not in a Khatma session

        const juzInfo = JUZ_DATA.find(j => j.juzNumber === activeJuz);
        if (!juzInfo) return;

        const currentSurahNum = surah.number;

        // If current surah is NOT the last surah in the Juz, auto-continue
        if (currentSurahNum < juzInfo.endSurahNumber) {
            const nextSurahNum = currentSurahNum + 1;
            // Small delay for smooth transition
            setTimeout(() => {
                // Save position before navigating away
                ReadingPositionService.save(
                    surah.number,
                    lastVerseNum,
                    surah.englishName,
                );
                // Navigate to next surah (replace so back button goes to Khatma, not previous surah)
                router.replace(`/surah/${nextSurahNum}?verse=1&autoplay=true`);
            }, 800);
        }
    }, [lastCompletedPlayback, surah, checkAutoCompleteJuz, router]);

    // ── Khatma auto-tracking: record pages as verses become visible ──
    // Using viewabilityConfigCallbackPairs ref for stable tracking with Animated.FlatList
    const viewabilityConfigCallbackPairs = useRef([
        {
            viewabilityConfig: {
                viewAreaCoveragePercentThreshold: 50,
                minimumViewTime: 500,
            },
            onViewableItemsChanged: ({ viewableItems }: { viewableItems: ViewToken[] }) => {
                const currentSurah = surahRef.current;
                if (!currentSurah) return;
                // Track the last visible verse for auto-save + auto-complete
                if (viewableItems.length > 0) {
                    const lastVisible = viewableItems[viewableItems.length - 1];
                    if (lastVisible?.item?.number) {
                        lastVisibleVerseRef.current = lastVisible.item.number;
                        checkAutoCompleteJuz(lastVisible.item.number); // Trigger auto-complete
                    }
                }
            },
        },
    ]);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | null = null;
        if (isRecording) {
            interval = setInterval(() => setRecordingDuration(d => d + 1), 1000);
        } else {
            setRecordingDuration(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isRecording]);

    // Auto-scroll to highlighted verse during Follow Along
    // Uses direct scrollToIndex (NOT scrollToVerse) because Follow Along fires
    // rapid matches and the 1.5s lock would block most scrolls.
    // This is safe: Follow Along is mutually exclusive with audio playback.
    useEffect(() => {
        if (followAlong.matchedVerseId && surah?.verses && flatListRef.current) {
            const verseIndex = surah.verses.findIndex(
                (v: Verse) => v.number === followAlong.matchedVerseId
            );
            if (verseIndex >= 0 && layoutReadyRef.current) {
                flatListRef.current.scrollToIndex({
                    index: verseIndex,
                    animated: true,
                    viewPosition: 0.5,
                });
            }
        }
    }, [followAlong.matchedVerseId, surah?.verses]);

    const handlePlaySurah = () => {
        if (surah) playFromVerse(surah, 1);
    };

    const handleRecordVerse = async (verseId: number) => {
        // Stop audio playback if starting a recording
        if (isPlaying) await stop();

        setRecordingVerseId(verseId);
        await startRecording();
    };

    const handleStopRecording = async () => {
        const uri = await stopRecording();
        if (uri) {
            setLastRecordingUri(uri);
            setSaveModalVisible(true);
        }
    };

    const handleNoteSurah = () => {
        if (!surah) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({
            pathname: '/note/edit',
            params: { surah: surah.number },
        });
    };

    const handleRecordSurah = async () => {
        if (!surah) return;
        if (isPlaying) await stop();
        setRecordingVerseId(undefined); // Surah level
        await startRecording();
    };

    // Handle Follow Along session stop with save modal
    const handleFollowAlongStop = async () => {
        const session = await followAlong.stopSession();
        if (session) {
            setCompletedFollowAlongSession(session);
            setFollowAlongModalVisible(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
    };

    if (loading) {
        return (
            <WaveBackground variant="spiritual" intensity="subtle">
                <View style={styles.center}>
                    <NoorMascot size={120} mood="calm" />
                    <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
                        Pause for Peace...
                    </Text>
                </View>
            </WaveBackground>
        );
    }

    if (error || !surah) {
        return (
            <View style={styles.center}>
                <Text style={{ color: theme.colors.error }}>{error || 'Surah not found'}</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Animated.FlatList
                style={{ flex: 1 }}
                ref={flatListRef}
                data={surah.verses}
                keyExtractor={(item: any) => `${surah.number}-${item.number}`}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                    useNativeDriver: false,
                })}
                onScrollToIndexFailed={onScrollToIndexFailed}
                onScrollBeginDrag={handleScrollBeginDrag}
                onLayout={() => { layoutReadyRef.current = true; }}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                windowSize={10}
                maxToRenderPerBatch={hasKhatmaTarget ? 20 : 8}
                initialNumToRender={hasKhatmaTarget ? 50 : 15}
                removeClippedSubviews={true}
                viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs.current}
                renderItem={({ item, index }: { item: any; index: number }) => (
                    <VerseItem
                        verse={item}
                        index={index}
                        isPlaying={
                            playingVerse?.surah === surah.number &&
                            playingVerse?.verse === item.number
                        }
                        hasNote={notes.some(
                            n => n.surahId === surah.number && n.verseId === item.number,
                        )}
                        onPlay={() => playFromVerse(surah, item.number)}
                        onPause={pause}
                        onNote={() =>
                            router.push({
                                pathname: '/note/edit',
                                params: { surah: surah.number, verse: item.number },
                            })
                        }
                        onRecord={() => handleRecordVerse(item.number)}
                        isStudyMode={isStudyMode}
                        isHighlighted={followAlong.matchedVerseId === item.number}
                    />
                )}
                contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
                ListHeaderComponent={() => {
                    const headerHeight = scrollY.interpolate({
                        inputRange: [-100, 0, 250],
                        outputRange: [500, 420, 150],
                        extrapolate: 'clamp',
                    });

                    const headerTranslate = scrollY.interpolate({
                        inputRange: [0, 250],
                        outputRange: [0, -30],
                        extrapolate: 'clamp',
                    });

                    const contentOpacity = scrollY.interpolate({
                        inputRange: [0, 180],
                        outputRange: [1, 0],
                        extrapolate: 'clamp',
                    });

                    const mascotScale = scrollY.interpolate({
                        inputRange: [-100, 0, 100],
                        outputRange: [1.2, 1, 0.8],
                        extrapolate: 'clamp',
                    });

                    return (
                        <Animated.View
                            style={[
                                styles.heroHeader,
                                {
                                    height: headerHeight,
                                    transform: [{ translateY: headerTranslate }],
                                },
                            ]}>
                            <WaveBackground
                                variant="spiritual"
                                intensity="medium"
                                style={StyleSheet.absoluteFillObject}
                            />

                            <Animated.View
                                style={[
                                    styles.heroContent,
                                    {
                                        opacity: contentOpacity,
                                        paddingTop: insets.top + 20,
                                    },
                                ]}>
                                <MotiView
                                    from={{ scale: 0.5, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ type: 'spring', delay: 300 }}>
                                    <Animated.View style={{ transform: [{ scale: mascotScale }] }}>
                                        <NoorMascot
                                            size={100}
                                            mood={followAlong.isActive ? "reading" : "happy"}
                                            animate={followAlong.isListening}
                                        />
                                    </Animated.View>
                                </MotiView>

                                <Text
                                    style={[
                                        styles.arabicTitle,
                                        { color: theme.colors.primary, marginTop: Spacing.md },
                                    ]}>
                                    {surah.name}
                                </Text>
                                <Text
                                    style={[
                                        styles.englishTitle,
                                        { color: theme.colors.onSurface },
                                    ]}>
                                    {surah.englishName}
                                </Text>
                                <Text
                                    style={[
                                        styles.translation,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {surah.englishNameTranslation}
                                </Text>
                                <View style={styles.metaRow}>
                                    <View
                                        style={[
                                            styles.metaBadge,
                                            { backgroundColor: theme.colors.primaryContainer },
                                        ]}>
                                        <Text
                                            style={[
                                                styles.metaText,
                                                { color: theme.colors.primary },
                                            ]}>
                                            {surah.revelationType}
                                        </Text>
                                    </View>
                                    <View
                                        style={[
                                            styles.metaBadge,
                                            { backgroundColor: theme.colors.surfaceVariant },
                                        ]}>
                                        <Text
                                            style={[
                                                styles.metaText,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            {surah.numberOfAyahs} Verses
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.actionRow}>
                                    <Pressable
                                        onPress={handlePlaySurah}
                                        style={({ pressed }) => [
                                            styles.mainPlayButton,
                                            { backgroundColor: theme.colors.primary },
                                            Shadows.primary,
                                            pressed && {
                                                opacity: 0.9,
                                                transform: [{ scale: 0.98 }],
                                            },
                                        ]}>
                                        <Ionicons name="play" size={20} color="#FFF" />
                                        <Text style={styles.playButtonText}>Play</Text>
                                    </Pressable>

                                    <IconButton
                                        icon="pencil-outline"
                                        mode="contained-tonal"
                                        containerColor={theme.colors.surfaceVariant}
                                        iconColor={theme.colors.primary}
                                        size={22}
                                        onPress={handleNoteSurah}
                                    />
                                    <IconButton
                                        icon="microphone-outline"
                                        mode="contained-tonal"
                                        containerColor={theme.colors.surfaceVariant}
                                        iconColor={theme.colors.secondary}
                                        size={22}
                                        onPress={handleRecordSurah}
                                    />

                                    <IconButton
                                        icon={isStudyMode ? 'school' : 'school-outline'}
                                        mode="contained-tonal"
                                        containerColor={
                                            isStudyMode
                                                ? theme.colors.primaryContainer
                                                : theme.colors.surfaceVariant
                                        }
                                        iconColor={
                                            isStudyMode
                                                ? theme.colors.primary
                                                : theme.colors.onSurfaceVariant
                                        }
                                        size={22}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            setIsStudyMode(!isStudyMode);
                                        }}
                                    />
                                </View>

                            </Animated.View>
                        </Animated.View>
                    );
                }}
            />

            <Animated.View
                style={[
                    styles.stickyHeader,
                    {
                        opacity: scrollY.interpolate({
                            inputRange: [150, 200],
                            outputRange: [0, 1],
                            extrapolate: 'clamp',
                        }),
                        paddingTop: insets.top,
                        backgroundColor: theme.colors.surface,
                    },
                ]}>
                <Pressable onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={theme.colors.onSurface} />
                </Pressable>

                <View style={styles.stickyTitleContainer}>
                    <Text
                        numberOfLines={1}
                        style={[styles.stickyArabicTitle, { color: theme.colors.primary }]}>
                        {surah.name}
                    </Text>
                    <Text
                        numberOfLines={1}
                        style={[styles.stickyTitle, { color: theme.colors.onSurface }]}>
                        {surah.englishName}
                    </Text>
                </View>

                <View style={styles.stickyActions}>
                    <IconButton
                        icon="pencil-outline"
                        iconColor={theme.colors.onSurfaceVariant}
                        size={20}
                        onPress={handleNoteSurah}
                        style={styles.stickyActionIcon}
                    />
                    <IconButton
                        icon="microphone-outline"
                        iconColor={theme.colors.onSurfaceVariant}
                        size={20}
                        onPress={handleRecordSurah}
                        style={styles.stickyActionIcon}
                    />

                    <IconButton
                        icon={isStudyMode ? 'school' : 'school-outline'}
                        iconColor={
                            isStudyMode ? theme.colors.primary : theme.colors.onSurfaceVariant
                        }
                        size={20}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            setIsStudyMode(!isStudyMode);
                        }}
                        style={styles.stickyActionIcon}
                    />
                    <IconButton
                        icon="play"
                        iconColor={theme.colors.primary}
                        size={24}
                        onPress={handlePlaySurah}
                        style={styles.stickyPlayButton}
                    />
                </View>
            </Animated.View>

            {/* Resume Reading Banner — floating overlay below sticky header */}
            <AnimatePresence>
                {showResumeBanner && savedPosition && (
                    <MotiView
                        from={{ opacity: 0, translateY: -10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        exit={{ opacity: 0, translateY: -10 }}
                        transition={{ type: 'spring', damping: 20 }}
                        style={[
                            styles.resumeBannerFloating,
                            {
                                top: insets.top + 56 + 8,
                                backgroundColor: theme.colors.surface,
                                borderColor: `${ACCENT_GOLD}40`,
                            },
                            Shadows.md,
                        ]}
                    >
                        <Pressable
                            onPress={handleResumeBannerPress}
                            style={styles.resumeBannerContent}
                        >
                            <View style={[styles.resumeIconCircle, { backgroundColor: `${ACCENT_GOLD}18` }]}>
                                <Ionicons name="location" size={16} color={ACCENT_GOLD} />
                            </View>
                            <View style={styles.resumeTextCol}>
                                <Text style={[styles.resumeBannerTitle, { color: theme.colors.onSurface }]}>
                                    Continue Reading
                                </Text>
                                <Text style={[styles.resumeBannerSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                                    Ayah {savedPosition.verse} · Tap to resume & play
                                </Text>
                            </View>
                            <Ionicons name="play-circle" size={28} color={ACCENT_GOLD} />
                        </Pressable>
                        <Pressable
                            onPress={() => setShowResumeBanner(false)}
                            hitSlop={12}
                            style={styles.resumeDismiss}
                        >
                            <Ionicons name="close" size={18} color={theme.colors.onSurfaceVariant} />
                        </Pressable>
                    </MotiView>
                )}
            </AnimatePresence>

            {/* Bars Container - AnimatePresence ensures smooth entry/exit */}
            <AnimatePresence>
                {playingVerse && !isRecording && (
                    <StickyAudioPlayer
                        isPlaying={isPlaying}
                        currentVerse={playingVerse}
                        onPause={pause}
                        onResume={resume}
                        onStop={stop}
                        verseText={surah.verses.find(v => v.number === playingVerse?.verse)?.text}
                    />
                )}
                {isRecording && (
                    <RecordingIndicatorBar
                        duration={recordingDuration}
                        onStop={handleStopRecording}
                        surahName={surah.englishName}
                        verseNumber={recordingVerseId}
                    />
                )}
            </AnimatePresence>

            {/* Save Modal */}
            <RecordingSaveModal
                visible={saveModalVisible}
                onDismiss={() => setSaveModalVisible(false)}
                recordingUri={lastRecordingUri}
                duration={recordingDuration}
                surahId={surah.number}
                verseId={recordingVerseId}
                onSaveComplete={() => setSaveModalVisible(false)}
            />
            {/* Voice Follow Along Overlay */}
            <VoiceFollowAlongOverlay
                visible={followAlong.isActive}
                isListening={followAlong.isListening}
                transcript={followAlong.transcript}
                matchConfidence={followAlong.matchConfidence}
                onStop={handleFollowAlongStop}
            />

            {/* Follow Along Save Modal */}
            <FollowAlongSaveModal
                visible={followAlongModalVisible}
                session={completedFollowAlongSession}
                onDismiss={() => {
                    setFollowAlongModalVisible(false);
                    setCompletedFollowAlongSession(null);
                }}
                onSaved={() => {
                    setFollowAlongModalVisible(false);
                    setCompletedFollowAlongSession(null);
                }}
            />

            {/* Follow Along is now accessible via the header icon buttons */}

            {/* Return to Audio — floating pill when user scrolls away from playing verse */}
            <AnimatePresence>
                {showReturnToAudio && playingVerse && (
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        exit={{ opacity: 0, translateY: 20 }}
                        transition={{ type: 'spring', damping: 18 }}
                        style={[
                            styles.returnToAudioContainer,
                            { bottom: insets.bottom + 80 },
                        ]}
                    >
                        <Pressable
                            onPress={handleReturnToAudio}
                            style={({ pressed }) => [
                                styles.returnToAudioPill,
                                { backgroundColor: ACCENT_GOLD, opacity: pressed ? 0.85 : 1 },
                                Shadows.md,
                            ]}
                        >
                            <Ionicons name="arrow-up" size={14} color="#FFF" />
                            <Text style={styles.returnToAudioText}>
                                Return
                            </Text>
                        </Pressable>
                    </MotiView>
                )}
            </AnimatePresence>

        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    heroHeader: {
        width: '100%',
        overflow: 'hidden',
    },
    heroContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    arabicTitle: {
        fontSize: 36,
        fontWeight: '700',
        textAlign: 'center',
    },
    englishTitle: {
        fontSize: 22,
        fontWeight: '800',
        marginTop: Spacing.xs,
    },
    translation: {
        fontSize: 14,
        marginTop: 4,
    },
    metaRow: {
        flexDirection: 'row',
        marginTop: Spacing.md,
        gap: Spacing.sm,
    },
    metaBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: BorderRadius.full,
    },
    metaText: {
        fontSize: 12,
        fontWeight: '600',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: Spacing.lg,
        gap: Spacing.sm,
    },
    mainPlayButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 28,
        paddingVertical: 12,
        borderRadius: BorderRadius.full,
        gap: 8,
    },
    playButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 16,
    },
    listContent: {
        backgroundColor: 'transparent',
    },
    stickyHeader: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        zIndex: 10,
        ...Shadows.sm,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    stickyTitleContainer: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
    },
    stickyArabicTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: -2,
    },
    stickyTitle: {
        fontSize: 13,
        fontWeight: '600',
        opacity: 0.8,
    },
    stickyActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    stickyActionIcon: {
        margin: 0,
        marginRight: -4,
    },
    stickyPlayButton: {
        margin: 0,
    },
    loadingText: {
        marginTop: Spacing.md,
        fontSize: 16,
        fontWeight: '500',
    },
    followAlongFab: {
        position: 'absolute',
        bottom: 180,
        right: Spacing.sm,
        borderRadius: BorderRadius.full,
        opacity: 0.9,
    },
    resumeBannerFloating: {
        position: 'absolute',
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
    },
    resumeBannerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    resumeIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resumeTextCol: {
        flex: 1,
    },
    resumeBannerTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    resumeBannerSubtitle: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 1,
    },
    resumeDismiss: {
        padding: 6,
        marginLeft: 4,
    },
    returnToAudioContainer: {
        position: 'absolute',
        alignSelf: 'center',
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 30,
    },
    returnToAudioPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 24,
        gap: 8,
    },
    returnToAudioText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '700',
    },
});
