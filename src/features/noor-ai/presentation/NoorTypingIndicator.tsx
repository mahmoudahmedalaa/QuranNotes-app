/**
 * NoorTypingIndicator — Premium "Noor is thinking…" indicator.
 *
 * Animated dots with Noor avatar and glow ring, displayed while
 * waiting for a Gemini response.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing } from '../../../core/theme/DesignSystem';

export default function NoorTypingIndicator() {
    const theme = useTheme();

    return (
        <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.row}
        >
            {/* Avatar with glow */}
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
                    <MotiView
                        from={{ rotate: '0deg' }}
                        animate={{ rotate: '180deg' }}
                        transition={{
                            type: 'timing',
                            duration: 2000,
                            loop: true,
                        }}
                    >
                        <MaterialCommunityIcons
                            name="creation"
                            size={16}
                            color={theme.colors.primary}
                        />
                    </MotiView>
                </View>
            </View>

            {/* Dots container */}
            <View
                style={[
                    styles.bubble,
                    {
                        backgroundColor: theme.dark ? '#18181B' : '#FFFFFF',
                        borderColor: theme.dark ? '#27272A' : '#E2E8F0',
                        shadowColor: theme.dark ? '#000' : '#6246EA',
                        shadowOpacity: theme.dark ? 0.2 : 0.05,
                    },
                ]}
            >
                {/* Accent stripe */}
                <View
                    style={[
                        styles.accentStripe,
                        { backgroundColor: theme.colors.primary },
                    ]}
                />
                <View style={styles.content}>
                    <View style={styles.dotsRow}>
                        {[0, 1, 2].map((i) => (
                            <MotiView
                                key={i}
                                from={{ opacity: 0.3, scale: 0.7 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                    type: 'timing',
                                    duration: 500,
                                    delay: i * 180,
                                    loop: true,
                                }}
                                style={[
                                    styles.dot,
                                    { backgroundColor: theme.colors.primary },
                                ]}
                            />
                        ))}
                    </View>
                    <Text
                        style={[
                            styles.label,
                            { color: theme.colors.onSurfaceVariant },
                        ]}
                    >
                        Noor is thinking…
                    </Text>
                </View>
            </View>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
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
    // ── Bubble ──
    bubble: {
        flexDirection: 'row',
        borderRadius: 20,
        borderBottomLeftRadius: 6,
        borderWidth: StyleSheet.hairlineWidth,
        overflow: 'hidden',
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 4,
        elevation: 1,
    },
    accentStripe: {
        width: 3,
        borderTopLeftRadius: 20,
        borderBottomLeftRadius: 6,
    },
    content: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 5,
        marginBottom: 4,
    },
    dot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    label: {
        fontSize: 11,
        fontWeight: '500',
    },
});
