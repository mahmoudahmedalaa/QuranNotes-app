import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Spacing, Gradients, BorderRadius } from '../../src/presentation/theme/DesignSystem';
import { ConsistencyHeatmap } from '../../src/presentation/components/stats/ConsistencyHeatmap';
import { ActivityChart } from '../../src/presentation/components/stats/ActivityChart';
import { TopicBreakdown } from '../../src/presentation/components/stats/TopicBreakdown';
import { StatsWidgetGrid } from '../../src/presentation/components/stats/StatsWidgetGrid';
import MoodInsightWidget from '../../src/presentation/components/mood/MoodInsightWidget';
import { useStreaks } from '../../src/infrastructure/auth/StreakContext';

const { width } = Dimensions.get('window');

import { useInsightsData } from '../../src/presentation/hooks/useInsightsData';

import { Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { usePro } from '../../src/infrastructure/auth/ProContext';

// ...

export default function InsightsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { isPro } = usePro();
    const { dailyActivity, heatmapData, topicBreakdown, stats, loading } = useInsightsData();

    if (!isPro) {
        return (
            <LinearGradient
                colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
                style={styles.container}>
                <SafeAreaView style={[styles.safeArea, { justifyContent: 'center', alignItems: 'center', padding: Spacing.xl }]}>
                    <View style={styles.header}>
                        <Text style={[styles.headerTitle, { color: theme.colors.onBackground, textAlign: 'center' }]}>
                            Insights
                        </Text>
                    </View>
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary, textAlign: 'center', marginBottom: Spacing.md }}>
                            Unlock Advanced Insights
                        </Text>
                        <Text variant="bodyLarge" style={{ textAlign: 'center', color: theme.colors.onSurfaceVariant, marginBottom: Spacing.xl }}>
                            Get detailed analytics, consistency heatmaps, and AI-powered reflections with Premium.
                        </Text>
                        <Button
                            mode="contained"
                            onPress={() => router.push('/paywall')}
                            style={{ borderRadius: BorderRadius.lg, width: '100%' }}
                            contentStyle={{ height: 50 }}
                        >
                            Unlock Premium
                        </Button>
                    </View>
                </SafeAreaView>
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
                        Insights
                    </Text>
                </View>

                <ScrollView
                    style={styles.content}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>
                    <StatsWidgetGrid
                        currentStreak={stats.currentStreak}
                        totalTime={`${stats.totalTimeMinutes}m`}
                        versesRead={stats.versesRead}
                        recordingsCount={stats.recordingsCount}
                    />

                    <ActivityChart data={dailyActivity} />

                    <ConsistencyHeatmap data={heatmapData} />

                    <TopicBreakdown
                        data={topicBreakdown}
                        totalTime={`${stats.totalTimeMinutes}m`}
                    />

                    <MoodInsightWidget />

                    <View style={{ height: Spacing.xl }} />
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
    },
    headerTitle: {
        fontSize: 34,
        fontWeight: '800',
        letterSpacing: -1,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 100,
    },
});
