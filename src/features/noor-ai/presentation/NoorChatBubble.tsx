/**
 * NoorChatBubble — Chat message bubble for the Noor AI conversation.
 *
 * User messages: right-aligned, brand violet background.
 * Noor messages: left-aligned, surface background with mascot avatar.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NoorMessage } from '../domain/types';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';

interface Props {
    message: NoorMessage;
    isLatest?: boolean;
}

export default function NoorChatBubble({ message, isLatest = false }: Props) {
    const theme = useTheme();
    const isUser = message.role === 'user';

    const bubbleStyle = isUser
        ? [styles.bubble, styles.userBubble, { backgroundColor: theme.colors.primary }]
        : [
            styles.bubble,
            styles.noorBubble,
            {
                backgroundColor: theme.dark
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(98, 70, 234, 0.06)',
            },
        ];

    const textColor = isUser ? '#FFFFFF' : theme.colors.onSurface;

    return (
        <MotiView
            from={isLatest ? { opacity: 0, translateY: 8, scale: 0.97 } : undefined}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={[styles.row, isUser ? styles.rowUser : styles.rowNoor]}
        >
            {/* Noor avatar */}
            {!isUser && (
                <View
                    style={[
                        styles.avatar,
                        {
                            backgroundColor: theme.dark
                                ? 'rgba(167, 139, 250, 0.15)'
                                : 'rgba(98, 70, 234, 0.1)',
                        },
                    ]}
                >
                    <MaterialCommunityIcons
                        name="star-four-points"
                        size={18}
                        color={theme.colors.primary}
                    />
                </View>
            )}

            <View style={bubbleStyle}>
                {/* Verse context badge */}
                {message.verseContext && !isUser && (
                    <View
                        style={[
                            styles.verseBadge,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.12)'
                                    : 'rgba(98, 70, 234, 0.08)',
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="book-open-page-variant-outline"
                            size={12}
                            color={theme.colors.primary}
                        />
                        <Text style={[styles.verseText, { color: theme.colors.primary }]}>
                            {message.verseContext.surahName} {message.verseContext.verseNumber}
                        </Text>
                    </View>
                )}

                <Text
                    style={[styles.messageText, { color: textColor }]}
                    selectable
                >
                    {message.content}
                </Text>

                {/* Timestamp */}
                <Text
                    style={[
                        styles.timestamp,
                        {
                            color: isUser
                                ? 'rgba(255,255,255,0.6)'
                                : theme.colors.onSurfaceVariant,
                        },
                    ]}
                >
                    {formatTime(message.timestamp)}
                </Text>
            </View>
        </MotiView>
    );
}

function formatTime(ts: number): string {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        marginBottom: Spacing.sm,
        paddingHorizontal: Spacing.md,
    },
    rowUser: {
        justifyContent: 'flex-end',
    },
    rowNoor: {
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
        marginBottom: 4,
    },
    bubble: {
        maxWidth: '78%',
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    userBubble: {
        borderRadius: BorderRadius.lg,
        borderBottomRightRadius: 4,
    },
    noorBubble: {
        borderRadius: BorderRadius.lg,
        borderBottomLeftRadius: 4,
    },
    verseBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        marginBottom: 6,
    },
    verseText: {
        fontSize: 11,
        fontWeight: '600',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    timestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
});
