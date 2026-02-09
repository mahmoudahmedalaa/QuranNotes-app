import React from 'react';
import { View, StyleSheet, FlatList, Pressable, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
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

// Sample surahs for onboarding (just show first few)
const SAMPLE_SURAHS = [
    { id: 1, name: 'Al-Fatiha', arabicName: 'الفاتحة', verses: 7 },
    { id: 2, name: 'Al-Baqarah', arabicName: 'البقرة', verses: 286 },
    { id: 3, name: 'Ali Imran', arabicName: 'آل عمران', verses: 200 },
    { id: 4, name: 'An-Nisa', arabicName: 'النساء', verses: 176 },
];

export default function OnboardingPickSurah() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();

    const handleSurahSelect = (surahId: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        goToStep(3);
        router.push({ pathname: '/onboarding/listen', params: { surahId } });
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await skipOnboarding();
        router.replace('/');
    };

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
                        <Text style={styles.coachText}>👆 Tap a Surah to explore</Text>
                    </View>
                    <View style={[styles.coachArrow, { borderTopColor: theme.colors.primary }]} />
                </MotiView>

                {/* Surah List with Spotlight Effect */}
                <View style={styles.listContainer}>
                    {SAMPLE_SURAHS.map((surah, index) => (
                        <MotiView
                            key={surah.id}
                            from={{ opacity: 0, translateX: -30 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ type: 'timing', duration: 300, delay: index * 100 }}>
                            <Pressable
                                onPress={() => index === 0 && handleSurahSelect(surah.id)}
                                style={({ pressed }) => [
                                    styles.surahCard,
                                    { backgroundColor: theme.colors.surface },
                                    Shadows.sm,
                                    index === 0
                                        ? styles.spotlightCard
                                        : { opacity: 0.6, saturation: 0 },
                                    index === 0 && pressed && styles.cardPressed,
                                ]}>
                                <View
                                    style={[
                                        styles.numberBadge,
                                        {
                                            backgroundColor:
                                                index === 0
                                                    ? theme.colors.primaryContainer
                                                    : theme.colors.surfaceVariant,
                                        },
                                    ]}>
                                    <Text
                                        style={[
                                            styles.numberText,
                                            {
                                                color:
                                                    index === 0
                                                        ? theme.colors.primary
                                                        : theme.colors.onSurfaceVariant,
                                            },
                                        ]}>
                                        {surah.id}
                                    </Text>
                                </View>
                                <View style={styles.surahInfo}>
                                    <Text
                                        style={[
                                            styles.surahName,
                                            { color: theme.colors.onSurface },
                                        ]}>
                                        {surah.name}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.surahMeta,
                                            { color: theme.colors.onSurfaceVariant },
                                        ]}>
                                        {surah.verses} verses
                                    </Text>
                                </View>
                                <Text
                                    style={[
                                        styles.arabicName,
                                        {
                                            color:
                                                index === 0
                                                    ? theme.colors.primary
                                                    : theme.colors.onSurfaceVariant,
                                        },
                                    ]}>
                                    {surah.arabicName}
                                </Text>
                            </Pressable>
                        </MotiView>
                    ))}
                </View>

                {/* Skip Link */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', duration: 300, delay: 600 }}
                    style={styles.skipContainer}>
                    <Pressable onPress={handleSkip}>
                        <Text style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>
                            Maybe Later
                        </Text>
                    </Pressable>
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
    coachArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 10,
        borderRightWidth: 10,
        borderTopWidth: 10,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -1,
    },
    listContainer: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        gap: Spacing.sm,
    },
    surahCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    spotlightCard: {
        borderWidth: 2,
        borderColor: '#5B7FFF',
        shadowColor: '#5B7FFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    cardPressed: {
        opacity: 0.9,
        transform: [{ scale: 0.98 }],
    },
    numberBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    numberText: {
        fontSize: 14,
        fontWeight: '700',
    },
    surahInfo: {
        flex: 1,
    },
    surahName: {
        fontSize: 16,
        fontWeight: '600',
    },
    surahMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    arabicName: {
        fontSize: 20,
        fontFamily: 'System', // Will use default Arabic font
    },
    skipContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    skipText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
