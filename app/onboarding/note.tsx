import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Pressable,
    TextInput,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

export default function OnboardingNote() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();
    const [noteText, setNoteText] = useState('');
    const [hasInteracted, setHasInteracted] = useState(false);

    const handleTextChange = (text: string) => {
        setNoteText(text);
        if (!hasInteracted && text.length > 0) {
            setHasInteracted(true);
        }
    };

    const handleContinue = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        goToStep(7);
        router.push('/onboarding/library-tour');
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await skipOnboarding();
        router.replace('/welcome');
    };

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
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
                                            step <= 6
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
                        <View
                            style={[styles.coachBubble, { backgroundColor: theme.colors.primary }]}>
                            <Text style={styles.coachText}>
                                📝 Write your thoughts on any verse
                            </Text>
                        </View>
                    </MotiView>

                    {/* Verse Reference */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', delay: 200 }}
                        style={styles.verseRef}>
                        <Text
                            style={[styles.verseRefText, { color: theme.colors.onSurfaceVariant }]}>
                            Ash-Sharh (The Relief) • Verses 5-6
                        </Text>
                        <Text style={[styles.verseArabic, { color: theme.colors.onSurface }]}>
                            "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا ۝ إِنَّ مَعَ الْعُسْرِ يُسْرًا"
                        </Text>
                    </MotiView>

                    {/* Note Editor */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: 300 }}
                        style={[
                            styles.noteCard,
                            { backgroundColor: theme.colors.surface },
                            Shadows.md,
                        ]}>
                        <View style={styles.noteHeader}>
                            <Ionicons name="pencil" size={18} color={theme.colors.primary} />
                            <Text style={[styles.noteLabel, { color: theme.colors.onSurface }]}>
                                Your Reflection
                            </Text>
                        </View>
                        <TextInput
                            style={[styles.noteInput, { color: theme.colors.onSurface }]}
                            placeholder="What does this verse mean to you? How can you apply it in your life?"
                            placeholderTextColor={theme.colors.onSurfaceVariant}
                            multiline
                            value={noteText}
                            onChangeText={handleTextChange}
                            textAlignVertical="top"
                        />
                    </MotiView>

                    {/* Info Text */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', delay: 500 }}
                        style={styles.infoContainer}>
                        <Text style={[styles.infoText, { color: theme.colors.onSurfaceVariant }]}>
                            Written notes are saved to your Library and can be organized into
                            folders
                        </Text>
                    </MotiView>

                    {/* Bottom Actions */}
                    <View style={styles.bottomContainer}>
                        <Button
                            mode="contained"
                            onPress={handleContinue}
                            style={styles.continueButton}
                            labelStyle={styles.continueLabel}>
                            {hasInteracted ? 'Save & Continue' : 'Skip for Now'}
                        </Button>

                        <Pressable onPress={handleSkip} style={styles.skipButton}>
                            <Text
                                style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>
                                Maybe Later
                            </Text>
                        </Pressable>
                    </View>
                </SafeAreaView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    keyboardView: {
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
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
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
    verseRef: {
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    verseRefText: {
        fontSize: 12,
        fontWeight: '500',
    },
    verseArabic: {
        fontSize: 20,
        marginTop: Spacing.xs,
    },
    noteCard: {
        marginHorizontal: Spacing.lg,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        flex: 1,
        maxHeight: 200,
    },
    noteHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    noteLabel: {
        fontSize: 14,
        fontWeight: '600',
    },
    noteInput: {
        flex: 1,
        fontSize: 15,
        lineHeight: 22,
    },
    infoContainer: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
    },
    infoText: {
        fontSize: 13,
        textAlign: 'center',
        lineHeight: 18,
    },
    bottomContainer: {
        alignItems: 'center',
        paddingBottom: Spacing.xl,
        paddingHorizontal: Spacing.lg,
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
        paddingVertical: Spacing.md,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
