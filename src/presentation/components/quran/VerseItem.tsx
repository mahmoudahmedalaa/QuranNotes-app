import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { IconButton, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { Verse } from '../../../domain/entities/Quran';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

interface VerseItemProps {
    verse: Verse;
    index: number;
    onPlay?: () => void;
    onNote?: () => void;
    onRecord?: () => void;
    onShare?: () => void;
    onLongPress?: () => void;
    isPlaying?: boolean;
    hasNote?: boolean;
    isStudyMode?: boolean;
    isHighlighted?: boolean;
}

export const VerseItem = ({
    verse,
    index,
    onPlay,
    onNote,
    onRecord,
    onShare,
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
        onPlay?.();
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
                    isPlaying && [
                        styles.activeContainer,
                        { backgroundColor: theme.colors.primaryContainer },
                    ],
                    isHighlighted && [
                        styles.highlightedContainer,
                        {
                            backgroundColor: theme.colors.tertiaryContainer,
                            borderColor: theme.colors.tertiary,
                        },
                    ],
                    pressed && { opacity: 0.95 },
                ]}>

                {/* Verse Number Badge — standalone row */}
                <View style={styles.numberRow}>
                    <View
                        style={[
                            styles.numberBadge,
                            { backgroundColor: theme.colors.surface },
                            Shadows.sm,
                        ]}>
                        <Text style={[styles.numberText, { color: theme.colors.primary }]}>
                            {verse.number}
                        </Text>
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

                {/* Action Buttons — clean row below content */}
                <View style={[
                    styles.actionsRow,
                    { borderTopColor: theme.colors.outlineVariant || 'rgba(0,0,0,0.06)' },
                ]}>
                    {onPlay && (
                        <Pressable
                            onPress={handlePlay}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                { backgroundColor: isPlaying ? theme.colors.primaryContainer : theme.colors.surface },
                                pressed && { opacity: 0.7 },
                            ]}>
                            <IconButton
                                icon={isPlaying ? 'pause-circle' : 'play-circle-outline'}
                                iconColor={theme.colors.primary}
                                size={18}
                                style={styles.actionIconInner}
                            />
                        </Pressable>
                    )}
                    {onNote && (
                        <Pressable
                            onPress={onNote}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                { backgroundColor: hasNote ? theme.colors.primaryContainer : theme.colors.surface },
                                pressed && { opacity: 0.7 },
                            ]}>
                            <IconButton
                                icon={hasNote ? 'pencil' : 'pencil-outline'}
                                iconColor={
                                    hasNote
                                        ? theme.colors.primary
                                        : theme.colors.onSurfaceVariant
                                }
                                size={18}
                                style={styles.actionIconInner}
                            />
                            {hasNote && (
                                <View
                                    style={[
                                        styles.noteDot,
                                        { backgroundColor: theme.colors.primary },
                                    ]}
                                />
                            )}
                        </Pressable>
                    )}
                    {onRecord && (
                        <Pressable
                            onPress={onRecord}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                { backgroundColor: theme.colors.surface },
                                pressed && { opacity: 0.7 },
                            ]}>
                            <IconButton
                                icon="microphone-outline"
                                iconColor={theme.colors.onSurfaceVariant}
                                size={18}
                                style={styles.actionIconInner}
                            />
                        </Pressable>
                    )}
                    {onShare && (
                        <Pressable
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onShare();
                            }}
                            style={({ pressed }) => [
                                styles.actionBtn,
                                { backgroundColor: theme.colors.surface },
                                pressed && { opacity: 0.7 },
                            ]}>
                            <IconButton
                                icon="share-variant-outline"
                                iconColor={theme.colors.onSurfaceVariant}
                                size={18}
                                style={styles.actionIconInner}
                            />
                        </Pressable>
                    )}
                </View>

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
    activeContainer: {
        borderRadius: BorderRadius.lg,
        marginHorizontal: Spacing.sm,
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
    numberRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: Spacing.md,
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
    textWrapper: {
        marginBottom: Spacing.md,
    },
    arabicText: {
        fontSize: 28,
        textAlign: 'right',
        lineHeight: 52,
    },
    translationText: {
        fontSize: 15,
        lineHeight: 24,
        textAlign: 'left',
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginTop: Spacing.lg,
        paddingTop: Spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    actionBtn: {
        borderRadius: BorderRadius.md,
        overflow: 'hidden',
    },
    actionIconInner: {
        margin: 0,
        width: 36,
        height: 36,
    },
    divider: {
        height: 1,
        opacity: 0.15,
        marginTop: Spacing.lg,
    },
    noteDot: {
        position: 'absolute',
        top: 2,
        right: 2,
        width: 8,
        height: 8,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#FFF',
    },
});
