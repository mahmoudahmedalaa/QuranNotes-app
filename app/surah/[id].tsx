import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ViewToken } from 'react-native';
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
import { useKhatma } from '../../src/infrastructure/khatma/KhatmaContext';
import { Verse } from '../../src/domain/entities/Quran';
import { ReadingPositionService, ReadingPosition } from '../../src/infrastructure/reading/ReadingPositionService';
import { BookmarkToast } from '../../src/presentation/components/feedback/BookmarkToast';
import {
    Spacing,
    Gradients,
    Shadows,
    BorderRadius,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const ACCENT_GOLD = '#D4A853';

export default function SurahDetail() {
    const { id, verse: verseParam, autoplay } = useLocalSearchParams<{ id: string; verse?: string; autoplay?: string }>();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const { surah, loading, error, loadSurah } = useQuran();
    const { playingVerse, isPlaying, playFromVerse, pause, resume, stop } = useAudio();
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const { notes } = useNotes();
    const followAlong = useVoiceFollowAlong(surah?.verses || [], surah?.number, surah?.englishName, surah?.name);

    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);
    const [recordingVerseId, setRecordingVerseId] = useState<number | undefined>();
    const [isStudyMode, setIsStudyMode] = useState(false);
    const [followAlongModalVisible, setFollowAlongModalVisible] = useState(false);
    const [completedFollowAlongSession, setCompletedFollowAlongSession] = useState<FollowAlongSession | null>(null);
    const flatListRef = useRef<any>(null);
    const { recordPageRead, saveBookmark } = useKhatma();
    const layoutReadyRef = useRef(false);
    const autoplayTriggeredRef = useRef(false);

    // ── Bookmark state ──
    const [bookmarkedVerse, setBookmarkedVerse] = useState<number | null>(null);
    const [showBookmarkToast, setShowBookmarkToast] = useState(false);
    const [toastVerseNumber, setToastVerseNumber] = useState(0);
    const [savedPosition, setSavedPosition] = useState<ReadingPosition | null>(null);
    const [showResumeBanner, setShowResumeBanner] = useState(false);

    useEffect(() => {
        if (id) loadSurah(Number(id));
    }, [id]);

    // ── Load saved reading position on mount ──
    useEffect(() => {
        if (!id) return;
        const surahId = Number(id);
        ReadingPositionService.get(surahId).then(pos => {
            if (pos) {
                setSavedPosition(pos);
                setBookmarkedVerse(pos.verse);
                // Show resume banner only if user has real progress (past verse 1)
                // and didn't navigate to a specific verse
                if (!verseParam && pos.verse > 1) {
                    setShowResumeBanner(true);
                }
            }
        });
    }, [id, verseParam]);

    // ── Bookmark handler ──
    const handleBookmarkVerse = useCallback((verse: Verse) => {
        const surahId = surah?.number;
        if (!surahId) return;

        // Save to both systems
        ReadingPositionService.save(surahId, verse.number, surah?.englishName);
        if (verse.page) {
            saveBookmark(verse.page, surahId, verse.number, surah?.englishName);
        }

        // Update local state so re-entry picks up new bookmark
        const newPos: ReadingPosition = { surah: surahId, verse: verse.number, timestamp: Date.now() };
        setSavedPosition(newPos);
        setBookmarkedVerse(verse.number);
        setToastVerseNumber(verse.number);
        setShowBookmarkToast(true);
    }, [surah, saveBookmark]);

    // ── Resume banner scroll handler ──
    const stickyHeaderHeight = insets.top + 56; // height of collapsed sticky header
    const handleResumeBannerPress = useCallback(async () => {
        if (!savedPosition || !surah?.verses || !flatListRef.current) return;
        const verseNum = savedPosition.verse;
        const index = surah.verses.findIndex((v: Verse) => v.number === verseNum);

        // Stop any current audio first to clear stale playingVerse highlight
        await stop();

        if (index >= 0) {
            flatListRef.current.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0,
                viewOffset: stickyHeaderHeight,
            });
            // Play from the bookmarked verse after scroll settles
            setTimeout(() => playFromVerse(surah, verseNum), 500);
        }
        setShowResumeBanner(false);
    }, [savedPosition, surah, playFromVerse, stop, stickyHeaderHeight]);

    // ── Scroll-to-bookmark: auto-scroll to verse when navigating from Khatma ──
    useEffect(() => {
        if (verseParam && surah?.verses && flatListRef.current) {
            const verseNum = Number(verseParam);
            const index = surah.verses.findIndex((v: Verse) => v.number === verseNum);
            if (index >= 0) {
                const tryScroll = () => {
                    if (layoutReadyRef.current) {
                        flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0, viewOffset: insets.top + 56 });
                        // Auto-play if coming from Khatma "Continue Reading"
                        if (autoplay === 'true' && !autoplayTriggeredRef.current) {
                            autoplayTriggeredRef.current = true;
                            setTimeout(() => playFromVerse(surah, verseNum), 400);
                        }
                    } else {
                        setTimeout(tryScroll, 200);
                    }
                };
                setTimeout(tryScroll, 300);
            }
        }
    }, [verseParam, surah]);

    // ── Auto-scroll to currently playing verse ──
    useEffect(() => {
        if (!surah?.verses || !playingVerse || !flatListRef.current) return;
        if (playingVerse.surah !== surah.number) return;

        const index = surah.verses.findIndex((v: Verse) => v.number === playingVerse.verse);
        if (index >= 0 && layoutReadyRef.current) {
            flatListRef.current.scrollToIndex({
                index,
                animated: true,
                viewPosition: 0.3,
            });
        }
    }, [playingVerse, surah]);

    // ── FlatList scroll error recovery ──
    const onScrollToIndexFailed = useCallback((info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
        const offset = info.averageItemLength * info.index;
        flatListRef.current?.scrollToOffset({ offset, animated: true });
        setTimeout(() => {
            flatListRef.current?.scrollToIndex({
                index: info.index,
                animated: true,
                viewPosition: 0,
                viewOffset: insets.top + 56,
            });
        }, 200);
    }, [insets.top]);

    // ── Khatma auto-tracking: record pages as verses become visible ──
    const viewabilityConfig = useMemo(() => ({
        viewAreaCoveragePercentThreshold: 50,
        minimumViewTime: 1500, // Must be visible for 1.5s to count as "read"
    }), []);

    const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
        if (!surah) return;
        viewableItems.forEach(({ item }) => {
            const verse = item as Verse;
            if (verse.page) {
                recordPageRead(verse.page, surah.number, verse.number, surah.englishName);
            }
        });
    }, [surah, recordPageRead]);

    // ── Khatma auto-tracking: record page when audio plays a verse ──
    // Also auto-advance reading position so "Continue Reading" follows the player
    useEffect(() => {
        if (!surah || !playingVerse) return;
        if (playingVerse.surah !== surah.number) return;
        const verse = surah.verses.find((v: Verse) => v.number === playingVerse.verse);
        if (verse?.page) {
            recordPageRead(verse.page, surah.number, verse.number, surah.englishName);
        }

        // Auto-advance reading position: update bookmark to follow the player
        // Only auto-advance forward — don't move backwards automatically
        const currentBookmark = bookmarkedVerse ?? 0;
        if (playingVerse.verse > currentBookmark) {
            ReadingPositionService.save(surah.number, playingVerse.verse, surah.englishName);
            setSavedPosition({ surah: surah.number, verse: playingVerse.verse, timestamp: Date.now() });
            setBookmarkedVerse(playingVerse.verse);
        }
    }, [surah, playingVerse, recordPageRead, bookmarkedVerse]);

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
    useEffect(() => {
        if (followAlong.matchedVerseId && surah?.verses && flatListRef.current) {
            const verseIndex = surah.verses.findIndex(
                (v: any) => v.number === followAlong.matchedVerseId
            );
            if (verseIndex >= 0) {
                flatListRef.current.scrollToIndex({
                    index: verseIndex,
                    animated: true,
                    viewPosition: 0.3, // Position verse 30% from top
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
                onLayout={() => { layoutReadyRef.current = true; }}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                viewabilityConfig={viewabilityConfig}
                onViewableItemsChanged={onViewableItemsChanged}
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
                        isBookmarked={bookmarkedVerse === item.number}
                        onBookmark={() => handleBookmarkVerse(item)}
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
                                <Ionicons name="bookmark" size={16} color={ACCENT_GOLD} />
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

            {/* Bookmark Toast */}
            <BookmarkToast
                visible={showBookmarkToast}
                verseNumber={toastVerseNumber}
                onDismiss={() => setShowBookmarkToast(false)}
            />

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
});
