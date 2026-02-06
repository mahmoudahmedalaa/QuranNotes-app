import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function OnboardingListen() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasPlayed, setHasPlayed] = useState(false);
    const [sound, setSound] = useState<Audio.Sound | null>(null);

    useEffect(() => {
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, [sound]);

    const handlePlayAudio = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        if (isPlaying && sound) {
            await sound.pauseAsync();
            setIsPlaying(false);
            return;
        }

        try {
            setIsPlaying(true);

            // Primary: EveryAyah CDN (Al-Fatiha verse 1)
            const primaryUrl = 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3';
            // Fallback: Islamic Network CDN
            const fallbackUrl = 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1:1.mp3';

            let newSound: Audio.Sound | null = null;

            try {
                const result = await Audio.Sound.createAsync(
                    { uri: primaryUrl },
                    { shouldPlay: true },
                );
                newSound = result.sound;
                console.log('[Onboarding] Playing from primary URL');
            } catch (primaryError) {
                console.log('[Onboarding] Primary failed, trying fallback');
                const result = await Audio.Sound.createAsync(
                    { uri: fallbackUrl },
                    { shouldPlay: true },
                );
                newSound = result.sound;
            }

            if (newSound) {
                setSound(newSound);
                setHasPlayed(true);

                // Auto-stop after 8 seconds for demo
                setTimeout(async () => {
                    try {
                        const status = await newSound!.getStatusAsync();
                        if (status.isLoaded) {
                            await newSound!.stopAsync();
                        }
                        setIsPlaying(false);
                    } catch (error) {
                        console.log('Error stopping sound:', error);
                        setIsPlaying(false);
                    }
                }, 8000);

                newSound.setOnPlaybackStatusUpdate(status => {
                    if (status.isLoaded && status.didJustFinish) {
                        setIsPlaying(false);
                    }
                });
            }
        } catch (error) {
            console.error('Audio error:', error);
            setIsPlaying(false);
            setHasPlayed(true); // Allow proceeding even if audio fails
        }
    };

    const handleContinue = async () => {
        if (sound) {
            await sound.stopAsync();
            await sound.unloadAsync();
        }
        goToStep(4);
        router.push('/onboarding/reciter');
    };

    const handleSkip = async () => {
        if (sound) {
            await sound.stopAsync();
            await sound.unloadAsync();
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await skipOnboarding();
        router.replace('/(tabs)');
    };

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Progress Indicator */}
                <View style={styles.progressContainer}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => (
                        <View
                            key={step}
                            style={[
                                styles.progressDot,
                                {
                                    backgroundColor:
                                        step <= 3
                                            ? theme.colors.primary
                                            : theme.colors.surfaceVariant,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Coach Mark Header */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={styles.header}>
                    <View style={[styles.coachBubble, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.coachText}>🎧 Listen to the beautiful recitation</Text>
                    </View>
                </MotiView>

                {/* Verse Card */}
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: 200 }}
                    style={[
                        styles.verseCard,
                        { backgroundColor: theme.colors.surface },
                        Shadows.md,
                    ]}>
                    <Text style={[styles.surahLabel, { color: theme.colors.onSurfaceVariant }]}>
                        Al-Fatiha • Verse 1
                    </Text>
                    <Text style={[styles.arabicText, { color: theme.colors.onSurface }]}>
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </Text>
                    <Text style={[styles.translation, { color: theme.colors.onSurfaceVariant }]}>
                        In the name of Allah, the Most Gracious, the Most Merciful
                    </Text>

                    {/* Play Button - Highlighted */}
                    <MotiView
                        animate={{
                            scale: hasPlayed ? 1 : [1, 1.05, 1],
                            borderColor: hasPlayed ? 'transparent' : theme.colors.primary,
                        }}
                        transition={{ loop: !hasPlayed, duration: 1500 }}
                        style={[
                            styles.playButtonWrapper,
                            !hasPlayed && {
                                borderWidth: 3,
                                borderRadius: 40,
                                borderColor: theme.colors.primary,
                            },
                        ]}>
                        <Pressable
                            onPress={handlePlayAudio}
                            style={[styles.playButton, { backgroundColor: theme.colors.primary }]}>
                            <Ionicons
                                name={isPlaying ? 'pause' : 'play'}
                                size={32}
                                color="#FFFFFF"
                            />
                        </Pressable>
                    </MotiView>

                    {isPlaying && (
                        <MotiView
                            from={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            style={styles.nowPlaying}>
                            <Text style={[styles.nowPlayingText, { color: theme.colors.primary }]}>
                                ♪ Now playing...
                            </Text>
                        </MotiView>
                    )}
                </MotiView>

                {/* Info Text */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', delay: 600 }}
                    style={styles.infoContainer}>
                    <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                        Every verse can be played with beautiful recitation from world-renowned
                        Qaris
                    </Text>
                </MotiView>

                {/* Bottom Actions */}
                <View style={styles.bottomContainer}>
                    {hasPlayed ? (
                        <Button
                            mode="contained"
                            onPress={handleContinue}
                            style={styles.continueButton}
                            labelStyle={styles.continueLabel}>
                            Continue
                        </Button>
                    ) : (
                        <Text style={[styles.tapHint, { color: theme.colors.onSurfaceVariant }]}>
                            Tap the play button above
                        </Text>
                    )}

                    <Pressable onPress={handleSkip} style={styles.skipButton}>
                        <Text style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>
                            Maybe Later
                        </Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        paddingTop: Spacing.md,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    header: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    coachBubble: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    coachText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    verseCard: {
        marginHorizontal: Spacing.lg,
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
    },
    surahLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: Spacing.sm,
    },
    arabicText: {
        fontSize: 28,
        fontFamily: 'System',
        textAlign: 'center',
        marginBottom: Spacing.md,
        lineHeight: 44,
    },
    translation: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: Spacing.xl,
    },
    playButtonWrapper: {
        padding: 4,
    },
    playButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#5B7FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    nowPlaying: {
        marginTop: Spacing.md,
    },
    nowPlayingText: {
        fontSize: 14,
        fontWeight: '500',
    },
    infoContainer: {
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
    },
    infoText: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    bottomContainer: {
        marginTop: 'auto',
        alignItems: 'center',
        paddingBottom: Spacing.xl,
    },
    continueButton: {
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.xxl,
    },
    continueLabel: {
        fontSize: 16,
        fontWeight: '600',
        paddingVertical: Spacing.xs,
    },
    tapHint: {
        fontSize: 14,
    },
    skipButton: {
        paddingVertical: Spacing.md,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
