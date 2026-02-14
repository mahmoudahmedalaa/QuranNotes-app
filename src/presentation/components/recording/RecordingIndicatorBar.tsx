import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';
import { MotiView, AnimatePresence } from 'moti';

interface RecordingIndicatorBarProps {
    duration: number;
    onStop: () => void;
    surahName?: string;
    verseNumber?: number;
}

export const RecordingIndicatorBar = ({
    duration,
    onStop,
    surahName,
    verseNumber,
}: RecordingIndicatorBarProps) => {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleStop = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onStop();
    };

    return (
        <MotiView
            from={{ translateY: 100, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 15 }}
            style={[
                styles.container,
                {
                    paddingBottom: insets.bottom + Spacing.md,
                    backgroundColor: theme.colors.elevation.level5,
                },
            ]}>
            <View style={styles.blurContainer}>
                <View style={styles.content}>
                    <View style={styles.leftSection}>
                        <MotiView
                            from={{ opacity: 0.3, scale: 0.8 }}
                            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                            transition={{ loop: true, duration: 1000 }}
                            style={styles.pulseDot}
                        />
                        <View style={styles.infoSection}>
                            <Text style={[styles.recordingLabel, { color: theme.colors.error }]}>
                                Recording
                            </Text>
                            <Text style={[styles.timer, { color: theme.colors.onSurface }]}>
                                {formatDuration(duration)}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.contextSection}>
                        {surahName && (
                            <Text
                                style={[
                                    styles.contextText,
                                    { color: theme.colors.onSurfaceVariant },
                                ]}>
                                {surahName} {verseNumber ? `• Verse ${verseNumber}` : ''}
                            </Text>
                        )}
                        <Text style={[styles.helperText, { color: theme.colors.onSurfaceVariant }]}>
                            Recite clearly...
                        </Text>
                    </View>

                    <Pressable
                        onPress={handleStop}
                        style={({ pressed }) => [
                            styles.stopButton,
                            { backgroundColor: theme.colors.error },
                            Shadows.md,
                            pressed && { scale: 0.95, opacity: 0.9 },
                        ]}>
                        <Ionicons name="stop" size={24} color="#FFF" />
                    </Pressable>
                </View>
            </View>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        ...Shadows.lg,
        elevation: 20,
    },
    blurContainer: {
        paddingTop: Spacing.md,
        paddingHorizontal: Spacing.lg,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 70,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    pulseDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#FF3B30',
        marginRight: Spacing.md,
    },
    infoSection: {
        justifyContent: 'center',
    },
    recordingLabel: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    timer: {
        fontSize: 24,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    contextSection: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: Spacing.sm,
    },
    contextText: {
        fontSize: 14,
        fontWeight: '700',
    },
    helperText: {
        fontSize: 11,
        opacity: 0.7,
    },
    stopButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
