import React, { useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
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

const SAMPLE_FOLDERS = [
    { name: 'Daily Reflections', icon: 'sunny', color: '#F59E0B' },
    { name: 'Ramadan Study', icon: 'moon', color: '#8B5CF6' },
    { name: 'Favorites', icon: 'heart', color: '#EF4444' },
];

export default function OnboardingFolders() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep, skipOnboarding } = useOnboarding();
    const [showCreate, setShowCreate] = useState(false);
    const [folderName, setFolderName] = useState('');

    const handleCreateFolder = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowCreate(true);
    };

    const handleContinue = () => {
        goToStep(9);
        router.push('/onboarding/reminders');
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
                                        step <= 8
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
                        <Text style={styles.coachText}>📁 Organize with Folders</Text>
                    </View>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        Group reflections by theme, surah, or topic
                    </Text>
                </MotiView>

                {/* Sample Folders */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', delay: 200 }}
                    style={styles.foldersContainer}>
                    <Text style={[styles.sectionLabel, { color: theme.colors.onSurfaceVariant }]}>
                        EXAMPLE FOLDERS
                    </Text>
                    {SAMPLE_FOLDERS.map((folder, index) => (
                        <MotiView
                            key={folder.name}
                            from={{ opacity: 0, translateX: -20 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            transition={{ type: 'timing', delay: 300 + index * 100 }}>
                            <View
                                style={[
                                    styles.folderCard,
                                    { backgroundColor: theme.colors.surface },
                                    Shadows.sm,
                                ]}>
                                <View
                                    style={[
                                        styles.folderIcon,
                                        { backgroundColor: `${folder.color}20` },
                                    ]}>
                                    <Ionicons
                                        name={folder.icon as any}
                                        size={20}
                                        color={folder.color}
                                    />
                                </View>
                                <Text
                                    style={[styles.folderName, { color: theme.colors.onSurface }]}>
                                    {folder.name}
                                </Text>
                                <Ionicons
                                    name="chevron-forward"
                                    size={18}
                                    color={theme.colors.onSurfaceVariant}
                                />
                            </View>
                        </MotiView>
                    ))}
                </MotiView>

                {/* Create Folder Section */}
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ type: 'timing', delay: 700 }}
                    style={styles.createSection}>
                    {!showCreate ? (
                        <Pressable
                            onPress={handleCreateFolder}
                            style={[styles.createButton, { borderColor: theme.colors.primary }]}>
                            <Ionicons name="add-circle" size={24} color={theme.colors.primary} />
                            <Text
                                style={[styles.createButtonText, { color: theme.colors.primary }]}>
                                Try creating a folder
                            </Text>
                        </Pressable>
                    ) : (
                        <MotiView
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={[
                                styles.createCard,
                                { backgroundColor: theme.colors.surface },
                                Shadows.md,
                            ]}>
                            <Text style={[styles.createLabel, { color: theme.colors.onSurface }]}>
                                New Folder Name
                            </Text>
                            <TextInput
                                style={[
                                    styles.createInput,
                                    {
                                        color: theme.colors.onSurface,
                                        backgroundColor: theme.colors.surfaceVariant,
                                    },
                                ]}
                                placeholder="e.g., My Quran Journey"
                                placeholderTextColor={theme.colors.onSurfaceVariant}
                                value={folderName}
                                onChangeText={setFolderName}
                            />
                            <Text
                                style={[
                                    styles.createHint,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}>
                                You can create this folder in the app later!
                            </Text>
                        </MotiView>
                    )}
                </MotiView>

                {/* Bottom Actions */}
                <View style={styles.bottomContainer}>
                    <Button
                        mode="contained"
                        onPress={handleContinue}
                        style={styles.continueButton}
                        labelStyle={styles.continueLabel}>
                        Almost Done!
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
    subtitle: {
        marginTop: Spacing.sm,
        fontSize: 14,
    },
    foldersContainer: {
        paddingHorizontal: Spacing.lg,
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
        marginLeft: Spacing.xs,
    },
    folderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        marginBottom: Spacing.sm,
    },
    folderIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    folderName: {
        flex: 1,
        fontSize: 15,
        fontWeight: '600',
    },
    createSection: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.lg,
        flex: 1,
    },
    createButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: BorderRadius.lg,
    },
    createButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    createCard: {
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    createLabel: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: Spacing.sm,
    },
    createInput: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.md,
        fontSize: 15,
    },
    createHint: {
        fontSize: 12,
        marginTop: Spacing.sm,
        textAlign: 'center',
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
