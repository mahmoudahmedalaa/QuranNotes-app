import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { Spacing } from '../theme/DesignSystem';
import { NoorMascot } from './mascot/NoorMascot';
import { QiblaHeaderIndicator } from '../../features/prayer/presentation/QiblaHeaderIndicator';

/**
 * Dashboard header with greeting, mascot, Qibla indicator, and settings.
 * The Ask Noor AI button lives below this header as a full-width featured row.
 */
export function DashboardHeader() {
    const router = useRouter();
    const theme = useTheme();

    return (
        <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 50 }}
            style={styles.header}>
            <View style={styles.headerContent}>
                <View style={styles.headerRow}>
                    <View style={styles.headerMascot}>
                        <NoorMascot mood="happy" size={44} />
                    </View>
                    <View style={styles.headerTextGroup}>
                        <Text style={[styles.greeting, { color: theme.colors.primary }]}>
                            Assalamualaikum
                        </Text>
                        <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>
                            Dashboard
                        </Text>
                    </View>
                </View>
            </View>
            <View style={styles.headerActions}>
                <QiblaHeaderIndicator />

                {/* ── Settings ── */}
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        router.push('/(tabs)/settings' as any);
                    }}
                    hitSlop={12}
                    style={({ pressed }) => [
                        styles.settingsButton,
                        { backgroundColor: theme.colors.surfaceVariant },
                        pressed && { opacity: 0.7, transform: [{ scale: 0.92 }] },
                    ]}
                >
                    <Feather name="settings" size={20} color={theme.colors.onSurfaceVariant} />
                </Pressable>
            </View>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 10,
    },
    headerContent: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    headerMascot: { marginRight: Spacing.sm },
    headerTextGroup: { justifyContent: 'center' },
    greeting: {
        fontSize: 13, fontWeight: '600', letterSpacing: 0.5,
        marginBottom: 2, textTransform: 'uppercase',
    },
    headerTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
    settingsButton: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
});
