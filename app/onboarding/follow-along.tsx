import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Icon } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function OnboardingFollowAlong() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();
    const [highlightedVerse, setHighlightedVerse] = useState(1);

    // Simulate verse highlighting animation
    React.useEffect(() => {
        const interval = setInterval(() => {
            setHighlightedVerse(prev => (prev % 3) + 1);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    const handleContinue = () => {
        goToStep(6);
        router.push('/onboarding/note');
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await skipOnboarding();
        router.replace('/welcome');
    };

    const MockVerse = ({ number, isHighlighted }: { number: number; isHighlighted: boolean }) => (
        <MotiView
            animate={{
                scale: isHighlighted ? 1.02 : 1,
                opacity: 1,
            }}
            transition={{ type: 'timing', duration: 300 }}
            style={[
                styles.mockVerse,
                {
                    backgroundColor: isHighlighted
                        ? theme.colors.tertiaryContainer
                        : theme.colors.surface,
                    borderColor: isHighlighted
                        ? theme.colors.tertiary
                        : theme.colors.outlineVariant,
                    shadowColor: isHighlighted ? theme.colors.tertiary : 'transparent',
                    shadowOpacity: isHighlighted ? 0.4 : 0,
                    shadowRadius: isHighlighted ? 12 : 0,
                },
            ]}>
            <View style={[styles.verseNumber, { backgroundColor: theme.colors.primaryContainer }]}>
                <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>{number}</Text>
            </View>
            <View style={styles.verseTextContainer}>
                <Text
                    style={[
                        styles.arabicMock,
                        { color: theme.colors.onSurface },
                    ]}>
                    {number === 1 ? 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' :
                        number === 2 ? 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' :
                            'الرَّحْمَٰنِ الرَّحِيمِ'}
                </Text>
            </View>
            {isHighlighted && (
                <MotiView
                    from={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring' }}>
                    <Icon source="check-circle" size={20} color={theme.colors.primary} />
                </MotiView>
            )}
        </MotiView>
    );

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Skip Button */}
                <View style={styles.header}>
                    <Button
                        mode="text"
                        textColor={theme.colors.onSurfaceVariant}
                        onPress={handleSkip}>
                        Skip
                    </Button>
                </View>

                {/* Icon */}
                <MotiView
                    from={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', delay: 200 }}
                    style={styles.iconWrapper}>
                    <LinearGradient
                        colors={[theme.colors.tertiaryContainer, theme.colors.tertiary + '40']}
                        style={styles.iconGradient}>
                        <Icon
                            source="access-point"
                            size={48}
                            color={theme.colors.tertiary}
                        />
                    </LinearGradient>
                </MotiView>

                {/* Title */}
                <MotiView
                    from={{ translateY: 20, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ type: 'timing', delay: 300 }}>
                    <Text style={[styles.title, { color: theme.colors.onSurface }]}>
                        Follow Along
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Recite out loud and watch verses highlight as you speak
                    </Text>
                </MotiView>

                {/* Mock Verse Demo */}
                <MotiView
                    from={{ translateY: 40, opacity: 0 }}
                    animate={{ translateY: 0, opacity: 1 }}
                    transition={{ type: 'timing', delay: 500 }}
                    style={styles.demoContainer}>
                    <MockVerse number={1} isHighlighted={highlightedVerse === 1} />
                    <MockVerse number={2} isHighlighted={highlightedVerse === 2} />
                    <MockVerse number={3} isHighlighted={highlightedVerse === 3} />
                </MotiView>

                {/* Feature Points */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 700 }}
                    style={styles.featuresContainer}>
                    <View style={styles.featureRow}>
                        <Icon source="microphone" size={18} color={theme.colors.primary} />
                        <Text style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                            Voice recognition follows your recitation
                        </Text>
                    </View>
                    <View style={styles.featureRow}>
                        <Icon source="sparkles" size={18} color={theme.colors.tertiary} />
                        <Text style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                            Verses glow as you recite them correctly
                        </Text>
                    </View>
                    <View style={styles.featureRow}>
                        <Icon source="chart-bar" size={18} color={theme.colors.secondary} />
                        <Text style={{ color: theme.colors.onSurfaceVariant, marginLeft: 8 }}>
                            Track your accuracy and progress
                        </Text>
                    </View>
                </MotiView>

                {/* Continue Button */}
                <View style={styles.footer}>
                    <Button
                        mode="contained"
                        onPress={handleContinue}
                        style={styles.continueButton}
                        labelStyle={styles.buttonLabel}>
                        Continue
                    </Button>

                    {/* Progress Dots */}
                    <View style={styles.progressDots}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <View
                                key={i}
                                style={[
                                    styles.dot,
                                    {
                                        backgroundColor:
                                            i === 5 ? theme.colors.primary : theme.colors.outline,
                                        width: i === 5 ? 24 : 8,
                                    },
                                ]}
                            />
                        ))}
                    </View>
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
        paddingHorizontal: Spacing.lg,
    },
    header: {
        alignItems: 'flex-end',
        paddingTop: Spacing.sm,
    },
    iconWrapper: {
        alignSelf: 'center',
        marginTop: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    iconGradient: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        textAlign: 'center',
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
        lineHeight: 24,
    },
    demoContainer: {
        marginTop: Spacing.xl,
        gap: Spacing.sm,
    },
    mockVerse: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        ...Shadows.sm,
    },
    verseNumber: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    verseTextContainer: {
        flex: 1,
    },
    arabicMock: {
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'right',
    },
    featuresContainer: {
        marginTop: Spacing.xl,
        gap: Spacing.md,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingBottom: Spacing.xl,
    },
    continueButton: {
        marginBottom: Spacing.lg,
    },
    buttonLabel: {
        fontWeight: '600',
        letterSpacing: 0.5,
    },
    progressDots: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
});
