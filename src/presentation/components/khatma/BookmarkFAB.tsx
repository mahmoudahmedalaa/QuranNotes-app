/**
 * BookmarkFAB — Floating bookmark button on the Surah screen
 * User taps to explicitly save their reading position.
 * Shows confirmation animation and triggers Khatma tracker update.
 */
import React, { useState, useCallback } from 'react';
import { StyleSheet, Pressable, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView, AnimatePresence } from 'moti';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { BorderRadius, Shadows } from '../../theme/DesignSystem';

const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
};

interface BookmarkFABProps {
    /** Call this to save the current reading position to Khatma */
    onBookmark: () => void;
    /** Whether there's a position to bookmark */
    hasPosition: boolean;
}

export const BookmarkFAB: React.FC<BookmarkFABProps> = ({
    onBookmark,
    hasPosition,
}) => {
    const theme = useTheme();
    const [saved, setSaved] = useState(false);

    const handlePress = useCallback(() => {
        if (!hasPosition) return;

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onBookmark();

        // Show saved state
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);

        // Show toast
        Toast.show({
            type: 'success',
            text1: 'Bookmark saved! 📖',
            text2: 'Khatma tracker updated',
            position: 'top',
            visibilityTime: 2500,
        });
    }, [onBookmark, hasPosition]);

    if (!hasPosition) return null;

    return (
        <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', damping: 14, delay: 800 }}
            style={styles.container}
        >
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => [
                    styles.fab,
                    {
                        backgroundColor: saved ? ACCENT.gold : theme.colors.surface,
                    },
                    Shadows.md,
                    pressed && { transform: [{ scale: 0.92 }] },
                ]}
            >
                <AnimatePresence>
                    {saved ? (
                        <MotiView
                            key="saved"
                            from={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            transition={{ type: 'spring', damping: 12 }}
                        >
                            <MaterialCommunityIcons name="check" size={24} color="#FFF" />
                        </MotiView>
                    ) : (
                        <MotiView
                            key="bookmark"
                            from={{ scale: 0.8 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', damping: 12 }}
                        >
                            <MaterialCommunityIcons
                                name="bookmark-plus-outline"
                                size={24}
                                color={ACCENT.gold}
                            />
                        </MotiView>
                    )}
                </AnimatePresence>
            </Pressable>
            {!saved && (
                <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>
                    Save
                </Text>
            )}
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 100, // Above the StickyAudioPlayer
        right: 16,
        alignItems: 'center',
        zIndex: 50,
    },
    fab: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },
    label: {
        fontSize: 10,
        fontWeight: '600',
        marginTop: 4,
    },
});
