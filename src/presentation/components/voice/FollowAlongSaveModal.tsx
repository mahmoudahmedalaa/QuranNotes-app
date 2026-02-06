import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Portal, Modal, useTheme, Surface } from 'react-native-paper';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { FollowAlongSession } from '../../../domain/entities/FollowAlongSession';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

interface FollowAlongSaveModalProps {
    visible: boolean;
    session: FollowAlongSession | null;
    onDismiss: () => void;
    onSaved: () => void;
}

export const FollowAlongSaveModal: React.FC<FollowAlongSaveModalProps> = ({
    visible,
    session,
    onDismiss,
    onSaved,
}) => {
    const theme = useTheme();

    if (!session) return null;

    const formatDuration = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const uniqueVerses = [...new Set(session.versesRecited)].length;
    const accuracyColor = session.accuracyPercentage > 70
        ? theme.colors.primary
        : session.accuracyPercentage > 40
            ? theme.colors.tertiary
            : theme.colors.error;

    const handleSave = () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onSaved();
    };

    return (
        <Portal>
            <Modal
                visible={visible}
                onDismiss={onDismiss}
                contentContainerStyle={[
                    styles.modalContainer,
                    { backgroundColor: theme.colors.elevation.level3 },
                ]}>
                {/* Success Animation */}
                <MotiView
                    from={{ scale: 0, opacity: 0, rotate: '-45deg' }}
                    animate={{ scale: 1, opacity: 1, rotate: '0deg' }}
                    transition={{ type: 'spring', damping: 12 }}>
                    <View
                        style={[
                            styles.iconContainer,
                            { backgroundColor: theme.colors.primaryContainer },
                        ]}>
                        <Ionicons name="checkmark-circle" size={48} color={theme.colors.primary} />
                    </View>
                </MotiView>

                <Text
                    variant="headlineSmall"
                    style={[styles.title, { color: theme.colors.onSurface }]}>
                    Session Complete!
                </Text>

                <Text
                    variant="titleMedium"
                    style={[styles.surahName, { color: theme.colors.primary }]}>
                    {session.surahNameArabic}
                </Text>
                <Text
                    variant="bodyMedium"
                    style={{ color: theme.colors.onSurfaceVariant, marginBottom: Spacing.lg }}>
                    {session.surahName}
                </Text>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
                        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                            {formatDuration(session.durationSeconds)}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Duration
                        </Text>
                    </Surface>

                    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="book-outline" size={20} color={theme.colors.secondary} />
                        <Text variant="titleLarge" style={{ color: theme.colors.onSurface }}>
                            {uniqueVerses}/{session.totalVerses}
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Verses
                        </Text>
                    </Surface>

                    <Surface style={[styles.statCard, { backgroundColor: theme.colors.surface }]}>
                        <Ionicons name="analytics-outline" size={20} color={accuracyColor} />
                        <Text variant="titleLarge" style={{ color: accuracyColor }}>
                            {session.accuracyPercentage}%
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Accuracy
                        </Text>
                    </Surface>
                </View>

                <Text
                    variant="bodySmall"
                    style={[styles.savedNote, { color: theme.colors.outline }]}>
                    Saved to Library → Recordings → Follow Alongs
                </Text>

                <Button
                    mode="contained"
                    onPress={handleSave}
                    style={styles.button}
                    labelStyle={styles.buttonLabel}>
                    Done
                </Button>
            </Modal>
        </Portal>
    );
};

const styles = StyleSheet.create({
    modalContainer: {
        margin: Spacing.lg,
        padding: Spacing.xl,
        borderRadius: BorderRadius.xl,
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontWeight: '700',
        marginBottom: Spacing.xs,
    },
    surahName: {
        fontSize: 24,
        fontWeight: '700',
    },
    statsGrid: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginBottom: Spacing.lg,
    },
    statCard: {
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
        minWidth: 90,
        gap: 4,
        ...Shadows.sm,
    },
    savedNote: {
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    button: {
        minWidth: 200,
    },
    buttonLabel: {
        fontWeight: '600',
        letterSpacing: 0.5,
    },
});
