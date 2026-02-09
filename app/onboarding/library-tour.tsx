import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
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

const { width } = Dimensions.get('window');

const LIBRARY_TABS = [
    {
        key: 'notes',
        icon: 'document-text',
        label: 'Notes',
        description: 'Written reflections on verses',
    },
    {
        key: 'recordings',
        icon: 'mic',
        label: 'Recordings',
        description: 'Voice notes and reflections',
    },
    { key: 'folders', icon: 'folder', label: 'Folders', description: 'Organize by theme or surah' },
];

export default function OnboardingLibraryTour() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();
    const [activeTabIndex, setActiveTabIndex] = useState(0);

    const handleTabTap = (index: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setActiveTabIndex(index);
    };

    const handleContinue = () => {
        goToStep(8);
        router.push('/onboarding/folders');
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
                {/* Progress Indicator */}
                <View style={styles.progressContainer}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(step => (
                        <View
                            key={step}
                            style={[
                                styles.progressDot,
                                {
                                    backgroundColor:
                                        step <= 7
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
                        <Text style={styles.coachText}>📚 Your Library - All in one place</Text>
                    </View>
                </MotiView>

                {/* Mock Library UI */}
                <MotiView
                    from={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: 200 }}
                    style={[
                        styles.mockLibrary,
                        { backgroundColor: theme.colors.surface },
                        Shadows.lg,
                    ]}>
                    {/* Mock Header */}
                    <View style={styles.mockHeader}>
                        <Text style={[styles.mockTitle, { color: theme.colors.onSurface }]}>
                            Library
                        </Text>
                    </View>

                    {/* Tab Bar */}
                    <View style={[styles.tabBar, { backgroundColor: theme.colors.surfaceVariant }]}>
                        {LIBRARY_TABS.map((tab, index) => (
                            <Pressable
                                key={tab.key}
                                onPress={() => handleTabTap(index)}
                                style={[
                                    styles.tab,
                                    activeTabIndex === index && {
                                        backgroundColor: theme.colors.surface,
                                    },
                                ]}>
                                <Ionicons
                                    name={tab.icon as any}
                                    size={18}
                                    color={
                                        activeTabIndex === index
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant
                                    }
                                />
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        {
                                            color:
                                                activeTabIndex === index
                                                    ? theme.colors.primary
                                                    : theme.colors.onSurfaceVariant,
                                        },
                                    ]}>
                                    {tab.label}
                                </Text>
                            </Pressable>
                        ))}
                    </View>

                    {/* Tab Content Description */}
                    <MotiView
                        key={activeTabIndex}
                        from={{ opacity: 0, translateX: 20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        transition={{ type: 'timing', duration: 200 }}
                        style={styles.tabContent}>
                        <View
                            style={[
                                styles.iconCircle,
                                { backgroundColor: theme.colors.primaryContainer },
                            ]}>
                            <Ionicons
                                name={LIBRARY_TABS[activeTabIndex].icon as any}
                                size={32}
                                color={theme.colors.primary}
                            />
                        </View>
                        <Text style={[styles.contentTitle, { color: theme.colors.onSurface }]}>
                            {LIBRARY_TABS[activeTabIndex].label}
                        </Text>
                        <Text
                            style={[
                                styles.contentDescription,
                                { color: theme.colors.onSurfaceVariant },
                            ]}>
                            {LIBRARY_TABS[activeTabIndex].description}
                        </Text>
                    </MotiView>

                    {/* Sample Items - Realistic Mocks */}
                    <View style={styles.sampleItems}>
                        {activeTabIndex === 0 && ( // Notes
                            <>
                                <View
                                    style={[
                                        styles.mockItem,
                                        { backgroundColor: theme.colors.surfaceVariant },
                                    ]}>
                                    <View style={[styles.mockIcon, { backgroundColor: '#E0E7FF' }]}>
                                        <Ionicons name="document-text" size={16} color="#4F46E5" />
                                    </View>
                                    <View style={styles.mockContent}>
                                        <Text
                                            style={[
                                                styles.mockItemTitle,
                                                { color: theme.colors.onSurface },
                                            ]}>
                                            Notes on Al-Fatiha
                                        </Text>
                                        <Text
                                            style={[
                                                styles.mockItemMeta,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            Verse 1 • Just now
                                        </Text>
                                    </View>
                                </View>
                                <View
                                    style={[
                                        styles.mockItem,
                                        { backgroundColor: theme.colors.surfaceVariant },
                                    ]}>
                                    <View style={[styles.mockIcon, { backgroundColor: '#FEF3C7' }]}>
                                        <Ionicons name="document-text" size={16} color="#D97706" />
                                    </View>
                                    <View style={styles.mockContent}>
                                        <Text
                                            style={[
                                                styles.mockItemTitle,
                                                { color: theme.colors.onSurface },
                                            ]}>
                                            Reflections on Gratitude
                                        </Text>
                                        <Text
                                            style={[
                                                styles.mockItemMeta,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            Al-Baqarah • Yesterday
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {activeTabIndex === 1 && ( // Recordings
                            <>
                                <View
                                    style={[
                                        styles.mockItem,
                                        { backgroundColor: theme.colors.surfaceVariant },
                                    ]}>
                                    <View style={[styles.mockIcon, { backgroundColor: '#FFEDD5' }]}>
                                        <Ionicons name="mic" size={16} color="#EA580C" />
                                    </View>
                                    <View style={styles.mockContent}>
                                        <Text
                                            style={[
                                                styles.mockItemTitle,
                                                { color: theme.colors.onSurface },
                                            ]}>
                                            My First Reflection
                                        </Text>
                                        <Text
                                            style={[
                                                styles.mockItemMeta,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            0:35 • Just now
                                        </Text>
                                    </View>
                                </View>
                                <View
                                    style={[
                                        styles.mockItem,
                                        { backgroundColor: theme.colors.surfaceVariant },
                                    ]}>
                                    <View style={[styles.mockIcon, { backgroundColor: '#DCFCE7' }]}>
                                        <Ionicons name="mic" size={16} color="#16A34A" />
                                    </View>
                                    <View style={styles.mockContent}>
                                        <Text
                                            style={[
                                                styles.mockItemTitle,
                                                { color: theme.colors.onSurface },
                                            ]}>
                                            Morning Recitation
                                        </Text>
                                        <Text
                                            style={[
                                                styles.mockItemMeta,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            2:15 • 2 days ago
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}

                        {activeTabIndex === 2 && ( // Folders
                            <>
                                <View
                                    style={[
                                        styles.mockItem,
                                        { backgroundColor: theme.colors.surfaceVariant },
                                    ]}>
                                    <View style={[styles.mockIcon, { backgroundColor: '#F3E8FF' }]}>
                                        <Ionicons name="folder" size={16} color="#9333EA" />
                                    </View>
                                    <View style={styles.mockContent}>
                                        <Text
                                            style={[
                                                styles.mockItemTitle,
                                                { color: theme.colors.onSurface },
                                            ]}>
                                            Ramadan 2024
                                        </Text>
                                        <Text
                                            style={[
                                                styles.mockItemMeta,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            3 items
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                </View>
                                <View
                                    style={[
                                        styles.mockItem,
                                        { backgroundColor: theme.colors.surfaceVariant },
                                    ]}>
                                    <View style={[styles.mockIcon, { backgroundColor: '#E0F2FE' }]}>
                                        <Ionicons name="folder" size={16} color="#0284C7" />
                                    </View>
                                    <View style={styles.mockContent}>
                                        <Text
                                            style={[
                                                styles.mockItemTitle,
                                                { color: theme.colors.onSurface },
                                            ]}>
                                            Daily Wird
                                        </Text>
                                        <Text
                                            style={[
                                                styles.mockItemMeta,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            12 items
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                </View>
                            </>
                        )}
                    </View>
                </MotiView>

                {/* Tap Hint */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', delay: 600 }}
                    style={styles.hintContainer}>
                    <Text style={[styles.hintText, { color: theme.colors.onSurfaceVariant }]}>
                        👆 Tap the tabs above to explore
                    </Text>
                </MotiView>

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
    mockLibrary: {
        marginHorizontal: Spacing.lg,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        flex: 1,
        maxHeight: 380,
    },
    mockHeader: {
        padding: Spacing.md,
    },
    mockTitle: {
        fontSize: 20,
        fontWeight: '700',
    },
    tabBar: {
        flexDirection: 'row',
        marginHorizontal: Spacing.sm,
        padding: 4,
        borderRadius: BorderRadius.md,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.sm,
        gap: 4,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    tabContent: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    contentTitle: {
        fontSize: 18,
        fontWeight: '700',
    },
    contentDescription: {
        fontSize: 13,
        marginTop: 4,
    },
    sampleItems: {
        paddingHorizontal: Spacing.md,
        gap: Spacing.sm,
    },
    mockItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.md,
    },
    mockIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mockContent: {
        flex: 1,
    },
    mockItemTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    mockItemMeta: {
        fontSize: 11,
        marginTop: 2,
    },
    hintContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    hintText: {
        fontSize: 14,
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
