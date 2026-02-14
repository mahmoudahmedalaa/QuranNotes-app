/**
 * GlobalMiniPlayer — Persistent audio controls shown across all screens
 * Appears above the tab bar when audio is playing.
 * Allows pause/resume/stop without navigating back to the surah screen.
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAudio } from '../../../infrastructure/audio/AudioContext';
import { Spacing, BorderRadius } from '../../theme/DesignSystem';

export const GlobalMiniPlayer: React.FC = () => {
    const theme = useTheme();
    const router = useRouter();
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { playingVerse, isPlaying, currentSurahName, currentSurahNum, pause, resume, stop } = useAudio();

    // Don't show if nothing is playing or paused (verse is null = fully stopped)
    if (!playingVerse) return null;

    // Don't show on the surah detail screen — it has its own StickyAudioPlayer
    if (pathname.startsWith('/surah/')) return null;

    const handlePlayPause = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isPlaying) {
            await pause();
        } else {
            await resume();
        }
    };

    const handleStop = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        await stop();
    };

    const handleTap = () => {
        if (currentSurahNum && playingVerse) {
            router.push(`/surah/${currentSurahNum}?verse=${playingVerse.verse}` as any);
        }
    };

    const surahLabel = currentSurahName || `Surah ${playingVerse.surah}`;

    return (
        <MotiView
            from={{ translateY: -60, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={[
                styles.container,
                {
                    backgroundColor: theme.colors.elevation.level4,
                    paddingTop: insets.top,
                },
            ]}
        >
            {/* Info — tappable to go to surah */}
            <Pressable
                onPress={handleTap}
                style={({ pressed }) => [
                    styles.infoArea,
                    pressed && { opacity: 0.7 },
                ]}
            >
                <View style={[styles.iconBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
                    <MaterialCommunityIcons
                        name={isPlaying ? 'volume-high' : 'volume-off'}
                        size={18}
                        color={theme.colors.primary}
                    />
                </View>
                <View style={styles.textArea}>
                    <Text
                        style={[styles.surahName, { color: theme.colors.onSurface }]}
                        numberOfLines={1}
                    >
                        {surahLabel}
                    </Text>
                    <Text style={[styles.verseInfo, { color: theme.colors.onSurfaceVariant }]}>
                        Verse {playingVerse.verse} · {isPlaying ? 'Playing' : 'Paused'}
                    </Text>
                </View>
            </Pressable>

            {/* Controls */}
            <View style={styles.controls}>
                <Pressable
                    onPress={handlePlayPause}
                    style={({ pressed }) => [
                        styles.controlButton,
                        { backgroundColor: theme.colors.primary },
                        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
                    ]}
                >
                    <MaterialCommunityIcons
                        name={isPlaying ? 'pause' : 'play'}
                        size={22}
                        color="#FFF"
                    />
                </Pressable>
                <Pressable
                    onPress={handleStop}
                    style={({ pressed }) => [
                        styles.closeButton,
                        pressed && { opacity: 0.6 },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="close"
                        size={20}
                        color={theme.colors.onSurfaceVariant}
                    />
                </Pressable>
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        borderBottomLeftRadius: BorderRadius.lg,
        borderBottomRightRadius: BorderRadius.lg,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        paddingBottom: Spacing.sm + 2,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
        zIndex: 100,
    },
    infoArea: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    iconBadge: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textArea: {
        flex: 1,
    },
    surahName: {
        fontSize: 14,
        fontWeight: '700',
    },
    verseInfo: {
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
    },
    controls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    controlButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
