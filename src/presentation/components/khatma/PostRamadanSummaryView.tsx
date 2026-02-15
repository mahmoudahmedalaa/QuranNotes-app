/**
 * PostRamadanSummaryView — Summary shown after Ramadan ends
 * Displays achievement stats, completion badge, and encouragement.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, Surface, MD3Theme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const ACCENT = {
    gold: '#F5A623',
    goldLight: '#F5A62320',
    green: '#10B981',
    greenLight: '#10B98120',
};

interface PostRamadanSummaryViewProps {
    completedJuzCount: number;
    totalPagesRead: number;
    streakDays: number;
    isComplete: boolean;
    currentRound: number;
}

export const PostRamadanSummaryView: React.FC<PostRamadanSummaryViewProps> = ({
    completedJuzCount,
    totalPagesRead,
    streakDays,
    isComplete,
    currentRound,
}) => {
    const theme = useTheme();
    const router = useRouter();

    return (
        <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <MotiView
                from={{ opacity: 0, translateY: -20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'spring', damping: 18 }}
            >
                <Text style={[styles.title, { color: theme.colors.onBackground }]}>
                    ختمة
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                    Ramadan 2026 Summary
                </Text>
            </MotiView>

            {/* Achievement Badge */}
            <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', damping: 14, delay: 200 }}
            >
                <Surface style={[styles.badgeCard, { backgroundColor: theme.colors.surface }]} elevation={2}>
                    <View style={[
                        styles.iconCircle,
                        { backgroundColor: isComplete ? ACCENT.goldLight : theme.colors.surfaceVariant },
                    ]}>
                        <MaterialCommunityIcons
                            name={isComplete ? 'trophy' : 'book-heart'}
                            size={44}
                            color={isComplete ? ACCENT.gold : theme.colors.onSurfaceVariant}
                        />
                    </View>
                    <Text style={[styles.badgeTitle, { color: theme.colors.onBackground }]}>
                        {isComplete
                            ? currentRound > 1
                                ? `${currentRound} Khatmas Complete! 🌟`
                                : 'Khatma Complete! 🎉'
                            : 'Ramadan Journey'}
                    </Text>
                    <Text style={[styles.badgeSubtitle, { color: theme.colors.onSurfaceVariant }]}>
                        {isComplete
                            ? 'Taqabbal Allahu minna wa minkum — May Allah accept from us and from you.'
                            : `You completed ${completedJuzCount}/30 Juz. Every verse counts! 🤲`}
                    </Text>
                </Surface>
            </MotiView>

            {/* Stats Row */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 400, delay: 400 }}
            >
                <View style={styles.statsRow}>
                    <StatItem
                        label="Juz Read"
                        value={`${completedJuzCount}/30`}
                        icon="book-open-variant"
                        color={ACCENT.green}
                        theme={theme}
                    />
                    <StatItem
                        label="Pages"
                        value={`${totalPagesRead}`}
                        icon="file-document"
                        color={ACCENT.gold}
                        theme={theme}
                    />
                    <StatItem
                        label="Streak"
                        value={`${streakDays}d`}
                        icon="fire"
                        color="#F59E0B"
                        theme={theme}
                    />
                </View>
            </MotiView>

            {/* Continue Reading */}
            <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 400, delay: 600 }}
            >
                <Pressable
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push('/' as any);
                    }}
                    style={({ pressed }) => [
                        styles.continueButton,
                        { backgroundColor: theme.colors.primary },
                        Shadows.primary,
                        pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                    ]}
                >
                    <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#FFF" />
                    <Text style={styles.continueText}>Continue Reading</Text>
                </Pressable>
            </MotiView>
        </ScrollView>
    );
};

// ── Stat Item helper ──

interface StatItemProps {
    label: string;
    value: string;
    icon: string;
    color: string;
    theme: MD3Theme;
}

function StatItem({ label, value, icon, color, theme }: StatItemProps) {
    return (
        <View style={[styles.statItem, { backgroundColor: theme.colors.surface }]}>
            <MaterialCommunityIcons name={icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']} size={22} color={color} />
            <Text style={[styles.statValue, { color: theme.colors.onBackground }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
    },
    content: {
        padding: Spacing.lg,
        paddingTop: Spacing.xl,
        gap: Spacing.lg,
    },
    title: {
        fontSize: 44,
        fontWeight: '800',
        textAlign: 'center',
        lineHeight: 54,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        marginTop: 4,
    },
    badgeCard: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.xl,
        alignItems: 'center',
        gap: Spacing.md,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    badgeTitle: {
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    },
    badgeSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    statsRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    statItem: {
        flex: 1,
        borderRadius: BorderRadius.lg,
        padding: Spacing.md,
        alignItems: 'center',
        gap: 4,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
    continueButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: BorderRadius.full,
        gap: 8,
    },
    continueText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
