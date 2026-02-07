import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconButton, useTheme, FAB } from 'react-native-paper';
import { MotiView, AnimatePresence } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useQuran } from '../../src/presentation/hooks/useQuran';
import { useAudioPlayer } from '../../src/presentation/hooks/useAudioPlayer';
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
import {
    Spacing,
    Gradients,
    Shadows,
    BorderRadius,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

export default function SurahDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const scrollY = useRef(new Animated.Value(0)).current;

    const { surah, loading, error, loadSurah } = useQuran();
    const { playingVerse, isPlaying, positionMillis, durationMillis, playFromVerse, pause, resume, stop } = useAudioPlayer();
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

    useEffect(() => {
        if (id) loadSurah(Number(id));
    }, [id]);

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

    // Determine bottom padding based on active bars
    const bottomOffset = insets.bottom + (isRecording || playingVerse ? 130 : 60);

    return (
        <View style={styles.container}>
            <Animated.FlatList
                ref={flatListRef}
                data={surah.verses}
                keyExtractor={(item: any) => `${surah.number}-${item.number}`}
                onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                    useNativeDriver: false,
                })}
                onScrollToIndexFailed={(info) => {
                    setTimeout(() => {
                        flatListRef.current?.scrollToIndex({
                            index: info.index,
                            animated: true,
                        });
                    }, 100);
                }}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
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
                contentContainerStyle={[styles.listContent, { paddingBottom: bottomOffset }]}
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
                        positionMillis={positionMillis}
                        durationMillis={durationMillis}
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
});
