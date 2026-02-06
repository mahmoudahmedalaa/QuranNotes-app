import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Text, useTheme, Button, ProgressBar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const LOCKED_FEATURES = [
    { icon: 'chart-box', title: 'Reflection Heatmap', description: 'Track your consistency' },
    { icon: 'fire', title: 'Streak Tracking', description: 'Build daily habits' },
    { icon: 'cloud-sync', title: 'Cloud Sync', description: 'Backup your data' },
    { icon: 'school', title: 'Smart Study Mode', description: 'Memorization helper' },
];

export default function OnboardingLibrary() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep } = useOnboarding();

    const handleContinue = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        goToStep(5);
        router.push('/onboarding/premium');
    };

    const handleFeatureTap = (featureIndex: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        goToStep(5);
        router.push({ pathname: '/onboarding/premium', params: { highlight: featureIndex } });
    };

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={styles.header}>
                    <Text style={[styles.title, { color: theme.colors.onBackground }]}>
                        Nice work! 🎉
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Here's your first reflection
                    </Text>
                </MotiView>

                {/* Recording Card */}
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: 200 }}
                    style={[
                        styles.recordingCard,
                        { backgroundColor: theme.colors.surface },
                        Shadows.md,
                    ]}>
                    <View style={styles.recordingRow}>
                        <View
                            style={[
                                styles.playButton,
                                { backgroundColor: theme.colors.primaryContainer },
                            ]}>
                            <Ionicons name="play" size={24} color={theme.colors.primary} />
                        </View>
                        <View style={styles.recordingInfo}>
                            <Text
                                style={[styles.recordingTitle, { color: theme.colors.onSurface }]}>
                                My First Reflection
                            </Text>
                            <Text
                                style={[
                                    styles.recordingMeta,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}>
                                Just now • Al-Fatiha 1:1
                            </Text>
                        </View>
                    </View>
                </MotiView>

                {/* Usage Progress */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', delay: 400 }}
                    style={styles.usageContainer}>
                    <View style={styles.usageHeader}>
                        <Text style={[styles.usageLabel, { color: theme.colors.onSurfaceVariant }]}>
                            Free recordings used
                        </Text>
                        <Text style={[styles.usageCount, { color: theme.colors.primary }]}>
                            1 of 10
                        </Text>
                    </View>
                    <ProgressBar
                        progress={0.1}
                        color={theme.colors.primary}
                        style={styles.progressBar}
                    />
                </MotiView>

                {/* Premium Features Grid */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', delay: 600 }}
                    style={styles.featuresSection}>
                    <Text style={[styles.featuresTitle, { color: theme.colors.onSurface }]}>
                        Unlock Premium
                    </Text>
                    <View style={styles.featuresGrid}>
                        {LOCKED_FEATURES.map((feature, index) => (
                            <Pressable
                                key={feature.title}
                                onPress={() => handleFeatureTap(index)}
                                style={({ pressed }) => [
                                    styles.featureCard,
                                    { backgroundColor: theme.colors.surface },
                                    Shadows.sm,
                                    pressed && styles.featureCardPressed,
                                ]}>
                                <View
                                    style={[
                                        styles.lockBadge,
                                        { backgroundColor: theme.colors.secondaryContainer },
                                    ]}>
                                    <Ionicons
                                        name="lock-closed"
                                        size={10}
                                        color={theme.colors.secondary}
                                    />
                                </View>
                                <MaterialCommunityIcons
                                    name={feature.icon as any}
                                    size={28}
                                    color={theme.colors.primary}
                                />
                                <Text
                                    style={[
                                        styles.featureTitle,
                                        { color: theme.colors.onSurface },
                                    ]}>
                                    {feature.title}
                                </Text>
                                <Text
                                    style={[
                                        styles.featureDescription,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {feature.description}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </MotiView>

                {/* Continue Button */}
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 800 }}
                    style={styles.bottomContainer}>
                    <Button
                        mode="contained"
                        onPress={handleContinue}
                        style={styles.continueButton}
                        labelStyle={styles.continueLabel}>
                        Continue
                    </Button>
                </MotiView>
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
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        marginTop: Spacing.xs,
    },
    recordingCard: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.md,
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    recordingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    playButton: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    recordingInfo: {
        flex: 1,
    },
    recordingTitle: {
        fontSize: 16,
        fontWeight: '600',
    },
    recordingMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    usageContainer: {
        marginHorizontal: Spacing.lg,
        marginTop: Spacing.lg,
    },
    usageHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: Spacing.xs,
    },
    usageLabel: {
        fontSize: 13,
    },
    usageCount: {
        fontSize: 13,
        fontWeight: '600',
    },
    progressBar: {
        height: 6,
        borderRadius: 3,
    },
    featuresSection: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.xl,
    },
    featuresTitle: {
        fontSize: 18,
        fontWeight: '700',
        marginBottom: Spacing.md,
    },
    featuresGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    featureCard: {
        width: '48%',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        alignItems: 'center',
        position: 'relative',
    },
    featureCardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    lockBadge: {
        position: 'absolute',
        top: Spacing.sm,
        right: Spacing.sm,
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureTitle: {
        fontSize: 13,
        fontWeight: '600',
        marginTop: Spacing.sm,
        textAlign: 'center',
    },
    featureDescription: {
        fontSize: 11,
        textAlign: 'center',
        marginTop: 2,
    },
    bottomContainer: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
    },
    continueButton: {
        borderRadius: BorderRadius.xl,
    },
    continueLabel: {
        fontSize: 16,
        fontWeight: '600',
        paddingVertical: Spacing.xs,
    },
});
