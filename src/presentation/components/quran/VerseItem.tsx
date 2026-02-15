import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Verse } from '../../../domain/entities/Quran';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const ACCENT = {
    gold: '#F5A623',
    goldBgLight: '#F5A62315',
    goldBgDark: '#3D2A0E',
    goldBorder: '#F5A62350',
};

interface VerseItemProps {
    verse: Verse;
    index: number;
    onPlay?: () => void;
    onPause?: () => void;
    onNote?: () => void;
    onRecord?: () => void;
    onLongPress?: () => void;
    isPlaying?: boolean;
    hasNote?: boolean;
    isStudyMode?: boolean;
    isHighlighted?: boolean; // For Follow Along feature
}

export const VerseItem = ({
    verse,
    index,
    onPlay,
    onPause,
    onNote,
    onRecord,
    onLongPress,
    isPlaying,
    hasNote,
    isStudyMode,
    isHighlighted,
}: VerseItemProps) => {
    const theme = useTheme();
    const [isPeeking, setIsPeeking] = React.useState(false);

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress?.();
    };

    const handlePlay = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isPlaying) {
            onPause?.();
        } else {
            onPlay?.();
        }
    };



    return (
        <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{
                type: 'timing',
                duration: 500,
                delay: Math.min(index * 50, 600),
            }}>
            <Pressable
                onLongPress={handleLongPress}
                style={({ pressed }) => [
                    styles.container,
                    { backgroundColor: theme.colors.background },
                    // Gold accent for currently-playing verse
                    isPlaying && [
                        styles.playingContainer,
                        {
                            backgroundColor: theme.dark
                                ? ACCENT.goldBgDark
                                : ACCENT.goldBgLight,
                            borderLeftColor: ACCENT.gold,
                        },
                    ],

                    isHighlighted && [
                        styles.highlightedContainer,
                        {
                            backgroundColor: theme.dark
                                ? '#2A2040'
                                : theme.colors.tertiaryContainer,
                            borderColor: theme.dark
                                ? '#7B5FFF80'
                                : theme.colors.tertiary,
                        },
                    ],
                    pressed && { opacity: 0.95 },
                ]}>
                {/* Header: Verse Number & Controls */}
                <View style={styles.header}>
                    <View
                        style={[
                            styles.numberBadge,
                            { backgroundColor: theme.colors.surface },
                            isPlaying && { backgroundColor: ACCENT.gold },
                            Shadows.sm,
                        ]}>
                        <Text
                            style={[
                                styles.numberText,
                                { color: theme.colors.primary },
                                isPlaying && { color: '#FFF' },
                            ]}>
                            {verse.number}
                        </Text>
                    </View>
                    <View style={styles.controlsRow}>
                        {onPlay && (
                            <IconButton
                                icon={isPlaying ? 'pause-circle' : 'play-circle-outline'}
                                iconColor={isPlaying ? ACCENT.gold : theme.colors.primary}
                                size={22}
                                onPress={handlePlay}
                                style={styles.controlButton}
                            />
                        )}
                        {onNote && (
                            <View>
                                <IconButton
                                    icon={hasNote ? 'pencil' : 'pencil-outline'}
                                    iconColor={
                                        hasNote
                                            ? theme.colors.primary
                                            : theme.colors.onSurfaceVariant
                                    }
                                    size={22}
                                    onPress={onNote}
                                    style={styles.controlButton}
                                />
                                {hasNote && (
                                    <View
                                        style={[
                                            styles.noteDot,
                                            { backgroundColor: theme.colors.primary },
                                        ]}
                                    />
                                )}
                            </View>
                        )}
                        {onRecord && (
                            <IconButton
                                icon="microphone-outline"
                                iconColor={theme.colors.onSurfaceVariant}
                                size={22}
                                onPress={onRecord}
                                style={styles.controlButton}
                            />
                        )}

                    </View>
                </View>

                {/* Arabic Text */}
                <Pressable
                    onPress={() => isStudyMode && setIsPeeking(!isPeeking)}
                    style={styles.textWrapper}>
                    <MotiView
                        animate={{
                            opacity: isStudyMode && !isPeeking ? 0.05 : 1,
                            scale: isStudyMode && !isPeeking ? 0.98 : 1,
                        }}
                        transition={{ type: 'timing', duration: 300 }}>
                        <Text style={[styles.arabicText, { color: theme.colors.onSurface }]}>
                            {verse.text}
                        </Text>
                    </MotiView>
                </Pressable>

                {/* Translation */}
                {verse.translation && (
                    <Text
                        style={[styles.translationText, { color: theme.colors.onSurfaceVariant }]}>
                        {verse.translation}
                    </Text>
                )}

                <View style={[styles.divider, { backgroundColor: theme.colors.outline }]} />
            </Pressable>
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
    },
    playingContainer: {
        borderLeftWidth: 3,
        borderRadius: BorderRadius.md,
        marginHorizontal: Spacing.xs,
    },

    highlightedContainer: {
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.sm,
        borderWidth: 2,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: Spacing.sm,
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    controlButton: {
        margin: 0,
    },
    numberBadge: {
        borderRadius: BorderRadius.md,
        width: 36,
        height: 36,
        justifyContent: 'center',
        alignItems: 'center',
    },
    numberText: {
        fontSize: 13,
        fontWeight: '700',
    },
    arabicText: {
        fontSize: 28,
        textAlign: 'right',
        lineHeight: 52,
    },
    textWrapper: {
        marginBottom: Spacing.md,
    },
    translationText: {
        fontSize: 15,
        lineHeight: 24,
        textAlign: 'left',
    },
    divider: {
        height: 1,
        opacity: 0.15,
        marginTop: Spacing.lg,
    },
    noteDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
});
