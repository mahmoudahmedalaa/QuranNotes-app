import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
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
import { RECITERS, getReciterById } from '../../src/domain/entities/Reciter';
import { useSettings } from '../../src/infrastructure/settings/SettingsContext';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

// Al-Fatiha Verse 1 location for preview
const PREVIEW_SURAH = 1;
const PREVIEW_AYAH = 1;

export default function OnboardingReciter() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();
    const { settings, updateSettings } = useSettings();
    const [selectedReciter, setSelectedReciter] = useState(settings.reciterId || RECITERS[0].id);
    const [playingReciter, setPlayingReciter] = useState<string | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);

    // Cleanup sound on unmount
    useEffect(() => {
        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const playPreview = async (reciterId: string) => {
        try {
            // STOP previous sound immediately
            if (soundRef.current) {
                const status = await soundRef.current.getStatusAsync();
                if (status.isLoaded) {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                }
                soundRef.current = null;
                setPlayingReciter(null);
            }

            setPlayingReciter(reciterId);
            const reciter = getReciterById(reciterId);
            const url = `https://everyayah.com/data/${reciter.cdnFolder}/001001.mp3`;

            await Audio.setAudioModeAsync({
                playsInSilentModeIOS: true,
                shouldDuckAndroid: true,
            });

            // Create and load new sound
            const { sound } = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });

            soundRef.current = sound;

            sound.setOnPlaybackStatusUpdate(status => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingReciter(null);
                    // Optional: unload after finish to save memory
                    // sound.unloadAsync();
                }
            });
        } catch (error) {
            console.error('Error playing preview:', error);
            setPlayingReciter(null);
        }
    };

    // Auto-play on mount
    useEffect(() => {
        playPreview(selectedReciter);
    }, []);

    const handleReciterSelect = (reciterId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedReciter(reciterId);
        updateSettings({ reciterId });
        playPreview(reciterId);
    };

    const handleContinue = async () => {
        // Stop audio before moving on
        if (soundRef.current) {
            await soundRef.current.stopAsync();
        }
        goToStep(5);
        router.push({ pathname: '/onboarding/record', params: { surahId: 1 } });
    };

    const handleSkip = async () => {
        if (soundRef.current) {
            await soundRef.current.stopAsync();
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await skipOnboarding();
        router.replace('/(tabs)');
    };

    const renderReciter = ({ item, index }: { item: (typeof RECITERS)[0]; index: number }) => {
        const isSelected = item.id === selectedReciter;
        const isPlaying = item.id === playingReciter;

        return (
            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', delay: index * 50 }}>
                <Pressable
                    onPress={() => handleReciterSelect(item.id)}
                    style={({ pressed }) => [
                        styles.card,
                        {
                            backgroundColor: theme.colors.surface,
                            borderColor: isSelected ? theme.colors.primary : 'transparent',
                            borderWidth: 2,
                        },
                        Shadows.sm,
                        pressed && styles.cardPressed,
                    ]}>
                    <View style={styles.cardContent}>
                        <View
                            style={[
                                styles.iconContainer,
                                {
                                    backgroundColor: isSelected
                                        ? theme.colors.primaryContainer
                                        : theme.colors.surfaceVariant,
                                },
                            ]}>
                            {isPlaying ? (
                                <Ionicons
                                    name="volume-high"
                                    size={20}
                                    color={theme.colors.primary}
                                />
                            ) : (
                                <Ionicons
                                    name="person"
                                    size={20}
                                    color={
                                        isSelected
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant
                                    }
                                />
                            )}
                        </View>
                        <View style={styles.textContainer}>
                            <Text
                                style={[
                                    styles.reciterName,
                                    {
                                        color: isSelected
                                            ? theme.colors.primary
                                            : theme.colors.onSurface,
                                    },
                                ]}>
                                {item.name}
                            </Text>
                            {isSelected && (
                                <Text
                                    style={[styles.selectedLabel, { color: theme.colors.primary }]}>
                                    Selected
                                </Text>
                            )}
                        </View>
                        {isPlaying && (
                            <MotiView
                                from={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                style={styles.playingIndicator}>
                                <Ionicons
                                    name="checkmark-circle"
                                    size={18}
                                    color={theme.colors.primary}
                                />
                            </MotiView>
                        )}
                    </View>
                </Pressable>
            </MotiView>
        );
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
                                        step <= 4
                                            ? theme.colors.primary
                                            : theme.colors.surfaceVariant,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                        Choose Your Reciter
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Tap to preview their voice
                    </Text>
                </View>

                {/* Reciter List */}
                <FlatList
                    data={RECITERS}
                    renderItem={renderReciter}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.list}
                    showsVerticalScrollIndicator={false}
                />

                {/* Bottom Actions */}
                <View style={styles.bottomContainer}>
                    <Button
                        mode="contained"
                        onPress={handleContinue}
                        style={styles.continueButton}
                        labelStyle={styles.continueLabel}>
                        Continue
                    </Button>

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
        paddingVertical: Spacing.lg,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
    },
    list: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: 100,
    },
    card: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.99 }],
    },
    cardContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    textContainer: {
        flex: 1,
    },
    reciterName: {
        fontSize: 16,
        fontWeight: '600',
    },
    selectedLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginTop: 2,
    },
    playingIndicator: {
        marginLeft: Spacing.sm,
    },
    bottomContainer: {
        padding: Spacing.lg,
        paddingBottom: Spacing.xl,
        backgroundColor: 'rgba(255,255,255,0)',
    },
    continueButton: {
        borderRadius: BorderRadius.xl,
        width: '100%',
    },
    continueLabel: {
        fontSize: 16,
        fontWeight: '600',
        paddingVertical: Spacing.xs,
    },
    skipButton: {
        marginTop: Spacing.md,
        alignItems: 'center',
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
