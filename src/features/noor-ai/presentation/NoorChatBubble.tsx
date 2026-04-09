/**
 * NoorChatBubble — Premium chat message bubble for the Noor AI conversation.
 *
 * User messages: right-aligned, gradient violet with drop shadow.
 * Noor messages: left-aligned, elevated card with left accent stripe.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { NoorMessage } from '../domain/types';
import { Spacing } from '../../../core/theme/DesignSystem';

interface Props {
    message: NoorMessage;
    isLatest?: boolean;
}

export default function NoorChatBubble({ message, isLatest = false }: Props) {
    const theme = useTheme();
    const isUser = message.role === 'user';

    const textColor = isUser ? '#FFFFFF' : theme.colors.onSurface;

    return (
        <MotiView
            from={isLatest ? { opacity: 0, translateY: 8, scale: 0.97 } : undefined}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{ type: 'spring', damping: 18, stiffness: 200 }}
            style={[styles.row, isUser ? styles.rowUser : styles.rowNoor]}
        >
            {/* Noor avatar with glow */}
            {!isUser && (
                <View style={styles.avatarContainer}>
                    <View
                        style={[
                            styles.avatarGlow,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.08)'
                                    : 'rgba(98, 70, 234, 0.06)',
                            },
                        ]}
                    />
                    <View
                        style={[
                            styles.avatar,
                            {
                                backgroundColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.18)'
                                    : 'rgba(98, 70, 234, 0.12)',
                                borderColor: theme.dark
                                    ? 'rgba(167, 139, 250, 0.25)'
                                    : 'rgba(98, 70, 234, 0.18)',
                            },
                        ]}
                    >
                        <MaterialCommunityIcons
                            name="creation"
                            size={16}
                            color={theme.colors.primary}
                        />
                    </View>
                </View>
            )}

            {isUser ? (
                /* ── User bubble: gradient + shadow ── */
                <View style={styles.userBubbleOuter}>
                    <LinearGradient
                        colors={
                            theme.dark
                                ? ['#8B5CF6', '#6D28D9'] as const
                                : ['#6246EA', '#7C3AED'] as const
                        }
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.userBubble}
                    >
                        <Text style={[styles.messageText, { color: textColor }]} selectable>
                            {message.content}
                        </Text>
                        <Text style={styles.userTimestamp}>
                            {formatTime(message.timestamp)}
                        </Text>
                    </LinearGradient>
                </View>
            ) : (
                /* ── Noor bubble: card with accent stripe ── */
                <View
                    style={[
                        styles.noorBubble,
                        {
                            backgroundColor: theme.dark ? '#18181B' : '#FFFFFF',
                            borderColor: theme.dark ? '#27272A' : '#E2E8F0',
                            shadowColor: theme.dark ? '#000000' : '#6246EA',
                            shadowOpacity: theme.dark ? 0.3 : 0.06,
                        },
                    ]}
                >
                    <View style={styles.noorContent}>
                        {/* Verse context badge */}
                        {message.verseContext && (
                            <View
                                style={[
                                    styles.verseBadge,
                                    {
                                        backgroundColor: theme.dark
                                            ? 'rgba(167, 139, 250, 0.12)'
                                            : 'rgba(98, 70, 234, 0.06)',
                                    },
                                ]}
                            >
                                <MaterialCommunityIcons
                                    name="book-open-page-variant-outline"
                                    size={11}
                                    color={theme.colors.primary}
                                />
                                <Text style={[styles.verseText, { color: theme.colors.primary }]}>
                                    {message.verseContext.surahName} {message.verseContext.verseNumber}
                                </Text>
                            </View>
                        )}

                        <Markdown
                            style={{
                                body: { color: textColor, fontSize: 15, lineHeight: 24 },
                                paragraph: { marginTop: 0, marginBottom: 10 },
                            }}
                        >
                            {message.content}
                        </Markdown>

                        <Text
                            style={[
                                styles.noorTimestamp,
                                { color: theme.colors.onSurfaceVariant },
                            ]}
                        >
                            {formatTime(message.timestamp)}
                        </Text>
                    </View>
                </View>
            )}
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
        marginBottom: 10,
        paddingHorizontal: Spacing.md,
    },
    rowUser: {
        justifyContent: 'flex-end',
    },
    rowNoor: {
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
    },
    // ── Avatar ──
    avatarContainer: {
        marginRight: 8,
        marginBottom: 4,
    },
    avatarGlow: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        top: -4,
        left: -4,
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
    },
    // ── User bubble ──
    userBubbleOuter: {
        maxWidth: '78%',
        borderRadius: 20,
        borderBottomRightRadius: 6,
        overflow: 'hidden',
        // Shadow
        shadowColor: '#6246EA',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    userBubble: {
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    userTimestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
        color: 'rgba(255,255,255,0.55)',
    },
    // ── Noor bubble ──
    noorBubble: {
        maxWidth: '82%',
        flexDirection: 'row',
        borderRadius: 20,
        borderBottomLeftRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        // Shadow
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 6,
        elevation: 2,
    },
    noorContent: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    // ── Shared ──
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
        lineHeight: 23,
    },
    noorTimestamp: {
        fontSize: 10,
        marginTop: 4,
        alignSelf: 'flex-end',
    },
});
