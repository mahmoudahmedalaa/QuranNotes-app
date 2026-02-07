import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import { useAudioRecorder } from '../../src/presentation/hooks/useAudioRecorder';
import { Spacing, BorderRadius, Gradients } from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const MIN_RECORDING_SECONDS = 5;

export default function OnboardingRecord() {
    const theme = useTheme();
    const router = useRouter();
    const { surahId } = useLocalSearchParams();
    const { goToStep, skipOnboarding, markRecordingMade } = useOnboarding();
    const { isRecording, startRecording, stopRecording } = useAudioRecorder();
    const [recordingDuration, setRecordingDuration] = useState(0);
    const [recordingComplete, setRecordingComplete] = useState(false);

    // Timer for recording duration
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isRecording) {
            interval = setInterval(() => setRecordingDuration(d => d + 1), 1000);
        }
        return () => clearInterval(interval);
    }, [isRecording]);

    const handleRecordPress = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        if (isRecording) {
            // Stop recording
            const uri = await stopRecording();
            if (uri && recordingDuration >= MIN_RECORDING_SECONDS) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                setRecordingComplete(true);
                markRecordingMade();
            }
        } else {
            // Start recording
            setRecordingDuration(0);
            await startRecording();
        }
    };

    const handleContinue = () => {
        goToStep(6);
        // router.push('/onboarding/follow-along'); // DISABLED PER USER REQUEST
        router.push('/onboarding/note');
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await skipOnboarding();
        router.replace('/welcome');
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const canProceed = recordingDuration >= MIN_RECORDING_SECONDS;

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Coach Mark Header */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={styles.header}>
                    <View style={[styles.coachBubble, { backgroundColor: theme.colors.primary }]}>
                        <Text style={styles.coachText}>
                            {recordingComplete
                                ? '✨ Beautiful! Your reflection is saved.'
                                : '🎙️ Hold to record (5 seconds min)'}
                        </Text>
                    </View>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Your recordings are saved to your Library and can be organized into folders
                    </Text>
                </MotiView>

                {/* Sample Verse Display */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', duration: 400, delay: 200 }}
                    style={[styles.verseCard, { backgroundColor: theme.colors.surface }]}>
                    <Text style={[styles.arabicText, { color: theme.colors.onSurface }]}>
                        بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                    </Text>
                    <Text style={[styles.translation, { color: theme.colors.onSurfaceVariant }]}>
                        In the name of Allah, the Most Gracious, the Most Merciful
                    </Text>
                </MotiView>

                {/* Recording Button */}
                <View style={styles.recordingContainer}>
                    {isRecording && (
                        <MotiView
                            from={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            style={styles.timerContainer}>
                            <Text style={[styles.timer, { color: theme.colors.error }]}>
                                {formatTime(recordingDuration)}
                            </Text>
                            <MotiView
                                animate={{ opacity: [0.4, 1, 0.4] }}
                                transition={{ loop: true, duration: 1500 }}>
                                <Text
                                    style={[
                                        styles.timerHint,
                                        { color: theme.colors.error, fontWeight: '700' },
                                    ]}>
                                    {canProceed
                                        ? '✓ READY'
                                        : `HOLD FOR ${MIN_RECORDING_SECONDS - recordingDuration}s`}
                                </Text>
                            </MotiView>
                        </MotiView>
                    )}

                    <Pressable
                        onPress={handleRecordPress}
                        style={({ pressed }) => [
                            styles.recordButton,
                            {
                                backgroundColor: isRecording
                                    ? theme.colors.error
                                    : theme.colors.primary,
                                transform: [{ scale: pressed ? 0.95 : 1 }],
                            },
                        ]}>
                        <MotiView
                            animate={{
                                scale: isRecording ? [1, 1.2, 1] : 1,
                            }}
                            transition={{ loop: isRecording, duration: 1000 }}>
                            <Ionicons
                                name={isRecording ? 'stop' : 'mic'}
                                size={40}
                                color="#FFFFFF"
                            />
                        </MotiView>
                    </Pressable>
                </View>

                {/* Continue or Skip */}
                <View style={styles.bottomContainer}>
                    {recordingComplete ? (
                        <Button
                            mode="contained"
                            onPress={handleContinue}
                            style={styles.continueButton}
                            labelStyle={styles.continueLabel}>
                            Continue
                        </Button>
                    ) : (
                        <Pressable onPress={handleSkip}>
                            <Text
                                style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>
                                Maybe Later
                            </Text>
                        </Pressable>
                    )}
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
    },
    recordingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    timerContainer: {
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
    timerBadge: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.full,
        marginBottom: Spacing.md,
    },
    timer: {
        fontSize: 56,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
        letterSpacing: -1,
    },
    timerHint: {
        fontSize: 14,
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    recordButton: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 10,
    },
    bottomContainer: {
        alignItems: 'center',
        paddingBottom: Spacing.xxl,
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
    skipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    subtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.xl,
        lineHeight: 20,
    },
});
