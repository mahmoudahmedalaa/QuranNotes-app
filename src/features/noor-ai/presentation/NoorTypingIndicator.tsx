/**
 * NoorTypingIndicator — Animated "Noor is thinking…" indicator.
 *
 * Three bouncing dots with the Noor avatar, displayed while waiting
 * for a Gemini response.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, BorderRadius } from '../../../core/theme/DesignSystem';

export default function NoorTypingIndicator() {
    const theme = useTheme();

    return (
        <MotiView
            from={{ opacity: 0, translateY: 6 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18 }}
            style={styles.row}
        >
            {/* Avatar */}
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

            {/* Dots container */}
            <View
                style={[
                    styles.bubble,
                    {
                        backgroundColor: theme.dark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(98, 70, 234, 0.06)',
                    },
                ]}
            >
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: BorderRadius.lg,
        borderBottomLeftRadius: 4,
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
