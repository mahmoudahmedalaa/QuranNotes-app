/**
 * TodayReadingCard — Reading card for Khatma.
 * Shows Juz info, surah range, total pages, and action buttons.
 *
 * Uses VERSE-BASED navigation (not page-based) for reliable Juz start.
 * Passes `khatmaJuz` as a URL param so the surah screen can:
 *   1. Auto-continue to the next surah within the Juz when a surah finishes
 *   2. Auto-complete the Juz when the last verse is reached
 *   3. Save khatma-specific reading positions
 *
 * "Continue Reading" detection: uses KhatmaReadingPosition (Juz-specific)
 * to track exactly where the user left off within each Juz.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { JuzInfo } from '../../../data/khatmaData';
import { KhatmaReadingPosition, KhatmaPosition } from '../../../infrastructure/khatma/KhatmaReadingPosition';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
    green: '#10B981',
    greenLight: '#10B98120',
};

interface TodayReadingCardProps {
    juz: JuzInfo;
    isCompleted: boolean;
    isToday: boolean;
    onToggle: () => void;
    isTrialExpired?: boolean;
    /** Increment this to force a refresh (e.g. on tab focus) */
    refreshKey?: number;
}

export const TodayReadingCard: React.FC<TodayReadingCardProps> = ({
    juz,
    isCompleted,
    isToday,
    onToggle,
    isTrialExpired,
    refreshKey,
}) => {
    const theme = useTheme();
    const router = useRouter();

    // Track Juz-specific reading position for "Continue Reading"
    const [savedPos, setSavedPos] = useState<KhatmaPosition | null>(null);

    useEffect(() => {
        KhatmaReadingPosition.get(juz.juzNumber).then(pos => {
            setSavedPos(pos);
        });
    }, [juz.juzNumber, refreshKey]);

    const hasStartedReading = savedPos !== null;

    const handleStartReading = () => {
        if (isTrialExpired) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            router.push('/paywall?reason=khatma');
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // Set active session so AudioKhatmaBridge saves positions for this Juz
        KhatmaReadingPosition.startSession(juz.juzNumber);

        if (hasStartedReading && savedPos) {
            // Resume from saved position within this Juz
            router.push(`/surah/${savedPos.surah}?verse=${savedPos.verse}&autoplay=true&khatmaJuz=${juz.juzNumber}`);
        } else {
            // First time: navigate to the Juz's start verse using VERSE-BASED navigation
            // This is reliable — no page-guessing, exact verse number
            router.push(`/surah/${juz.startSurahNumber}?verse=${juz.startVerseNumber}&autoplay=true&khatmaJuz=${juz.juzNumber}`);
        }
    };

    const getHeaderText = () => {
        if (isCompleted) return 'Completed';
        if (isToday) return "Today's Reading";
        return `Juz ${juz.juzNumber}`;
    };

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
                        <View style={styles.headerInfo}>
                            <Text style={[styles.headerText, { color: theme.colors.onSurface }]}>
                                {getHeaderText()}
                            </Text>
                            <Text style={[styles.juzLabel, { color: theme.colors.onSurfaceVariant }]}>
                                Juz {juz.juzNumber} · {juz.startSurah} → {juz.endSurah} · {juz.totalPages} pages
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                    {!isCompleted && (
                        <Pressable
                            onPress={handleStartReading}
                            style={({ pressed }) => [
                                styles.continueButton,
                                { backgroundColor: theme.colors.primary },
                                Shadows.primary,
                                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                            ]}
                        >
                            <MaterialCommunityIcons
                                name={hasStartedReading ? 'book-open-page-variant' : 'book-open-variant'}
                                size={18}
                                color="#FFF"
                            />
                            <Text style={styles.continueButtonText}>
                                {hasStartedReading ? 'Continue Reading' : 'Start Reading'}
                            </Text>
                        </Pressable>
                    )}

                    <Pressable
                        onPress={() => {
                            if (isCompleted) {
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
                                                KhatmaReadingPosition.clear(juz.juzNumber);
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
        flex: 1,
    },
    headerInfo: {
        flex: 1,
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
