/**
 * TodayReadingCard — Smart reading card with page-level progress
 * Uses warm accent colors for progress, unified circle checkmarks
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useTheme, ProgressBar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useAudio } from '../../../infrastructure/audio/AudioContext';
import { JuzInfo } from '../../../data/khatmaData';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

// Warm accent palette (alpha-channel for dark mode compatibility)
const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
    green: '#10B981',
    greenLight: '#10B98120',
    progressGradientStart: '#F5A623',
    progressGradientEnd: '#F97316',
};

interface LastReadPosition {
    surah: number;
    surahName?: string;
    verse: number;
    page: number;
    timestamp: number;
}

interface TodayReadingCardProps {
    juz: JuzInfo;
    pagesRead: number;
    totalPages: number;
    percent: number;
    lastPosition?: LastReadPosition;
    isCompleted: boolean;
    isToday: boolean;
    onToggle: () => void;
    isTrialExpired?: boolean;
}

export const TodayReadingCard: React.FC<TodayReadingCardProps> = ({
    juz,
    pagesRead,
    totalPages,
    percent,
    lastPosition,
    isCompleted,
    isToday,
    onToggle,
    isTrialExpired,
}) => {
    const theme = useTheme();
    const router = useRouter();
    const { playingVerse, currentSurahNum } = useAudio();

    // Use audio's live position if audio is playing within a surah that belongs to this Juz
    const audioIsRelevant = playingVerse && currentSurahNum &&
        currentSurahNum >= juz.startSurahNumber && currentSurahNum <= juz.endSurahNumber;

    const resumeSurahNumber = audioIsRelevant ? currentSurahNum! : (lastPosition?.surah || juz.startSurahNumber);
    const resumeVerse = audioIsRelevant ? playingVerse!.verse : lastPosition?.verse;

    const handleContinueReading = () => {
        // Premium gate: trial expired → show paywall
        if (isTrialExpired) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.push('/paywall?reason=khatma');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        if (resumeVerse) {
            router.push(`/surah/${resumeSurahNumber}?verse=${resumeVerse}&autoplay=true`);
        } else {
            router.push(`/surah/${juz.startSurahNumber}?autoplay=true`);
        }
    };

    const getHeaderText = () => {
        if (isCompleted) return 'Completed';
        if (!isToday) return `Juz ${juz.juzNumber}`;
        if (lastPosition) return 'Pick up where you left off';
        return "Today's Reading";
    };

    const getCtaText = () => {
        if (lastPosition && pagesRead > 0) return 'Continue Reading';
        return 'Start Reading';
    };

    const getResumeText = () => {
        if (!lastPosition) return null;
        const surahName = lastPosition.surahName || `Surah ${lastPosition.surah}`;
        return `${surahName}, Verse ${lastPosition.verse} — Page ${lastPosition.page}`;
    };

    const resumeText = getResumeText();

    return (
        <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 20, delay: 100 }}
        >
            <View
                style={[
                    styles.card,
                    { backgroundColor: theme.colors.surface },
                    Shadows.md,
                ]}
            >
                {/* Header */}
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <View
                            style={[
                                styles.juzBadge,
                                {
                                    backgroundColor: isCompleted
                                        ? ACCENT.green
                                        : ACCENT.goldLight,
                                },
                            ]}
                        >
                            {isCompleted ? (
                                <MaterialCommunityIcons name="check" size={20} color="#FFF" />
                            ) : (
                                <Text style={[styles.juzNumber, { color: ACCENT.gold }]}>
                                    {juz.juzNumber}
                                </Text>
                            )}
                        </View>
                        <View>
                            <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
                                {getHeaderText()}
                            </Text>
                            <Text style={[styles.juzLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Juz {juz.juzNumber} · {juz.startSurah} → {juz.endSurah} · {juz.totalPages} pages
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Progress Section — warm accent bar */}
                {!isCompleted && (
                    <View style={styles.progressSection}>
                        <View style={styles.progressHeader}>
                            <Text style={[styles.progressLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Progress
                            </Text>
                            <Text style={[styles.progressCount, { color: ACCENT.gold }]}>
                                {pagesRead} of {totalPages} pages
                            </Text>
                        </View>
                        <ProgressBar
                            progress={percent}
                            color={ACCENT.gold}
                            style={[styles.progressBar, { backgroundColor: ACCENT.goldLight }]}
                        />
                    </View>
                )}

                {/* Resume Context */}
                {resumeText && !isCompleted && (
                    <View style={styles.resumeContext}>
                        <MaterialCommunityIcons
                            name="bookmark-outline"
                            size={14}
                            color={ACCENT.gold}
                        />
                        <Text style={[styles.resumeText, { color: theme.colors.onSurfaceVariant }]}>
                            {resumeText}
                        </Text>
                    </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    {!isCompleted && (
                        <Pressable
                            onPress={handleContinueReading}
                            style={({ pressed }) => [
                                styles.continueButton,
                                { backgroundColor: theme.colors.primary },
                                Shadows.primary,
                                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name="book-open-page-variant"
                                size={18}
                                color="#FFF"
                            />
                            <Text style={styles.continueButtonText}>
                                {getCtaText()}
                            </Text>
                        </Pressable>
                    )}

                    <Pressable
                        onPress={() => {
                            if (isCompleted) {
                                // Confirm before resetting
                                Alert.alert(
                                    'Start Over?',
                                    `This will reset progress for Juz ${juz.juzNumber}. You can always complete it again.`,
                                    [
                                        { text: 'Cancel', style: 'cancel' },
                                        {
                                            text: 'Start Over',
                                            style: 'destructive',
                                            onPress: () => {
                                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                                onToggle();
                                            },
                                        },
                                    ]
                                );
                            } else {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                onToggle();
                            }
                        }}
                        style={({ pressed }) => [
                            styles.toggleButton,
                            {
                                backgroundColor: isCompleted
                                    ? theme.colors.surfaceVariant
                                    : ACCENT.greenLight,
                                flex: isCompleted ? undefined : 0,
                            },
                            pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name={isCompleted ? 'restart' : 'check-circle-outline'}
                            size={18}
                            color={isCompleted ? theme.colors.onSurfaceVariant : ACCENT.green}
                        />
                        <Text
                            style={[
                                styles.toggleButtonText,
                                {
                                    color: isCompleted
                                        ? theme.colors.onSurfaceVariant
                                        : ACCENT.green,
                                },
                            ]}
                        >
                            {isCompleted ? 'Start Over' : 'Mark Complete'}
                        </Text>
                    </Pressable>
                </View>
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        marginHorizontal: Spacing.xs,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    juzBadge: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    juzNumber: {
        fontSize: 17,
        fontWeight: '800',
    },
    headerText: {
        fontSize: 16,
        fontWeight: '700',
    },
    juzLabel: {
        fontSize: 13,
    },
    progressSection: {
        marginTop: Spacing.md,
    },
    progressHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    progressLabel: {
        fontSize: 13,
        fontWeight: '500',
    },
    progressCount: {
        fontSize: 13,
        fontWeight: '700',
    },
    progressBar: {
        height: 8,
        borderRadius: 4,
    },
    resumeContext: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: Spacing.sm,
    },
    resumeText: {
        fontSize: 12,
        fontWeight: '500',
        flex: 1,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    continueButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        borderRadius: BorderRadius.full,
        gap: 8,
    },
    continueButtonText: {
        color: '#FFF',
        fontWeight: '700',
        fontSize: 15,
    },
    toggleButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: BorderRadius.full,
        gap: 6,
    },
    toggleButtonText: {
        fontWeight: '600',
        fontSize: 13,
    },
});
