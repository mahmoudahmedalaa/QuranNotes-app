import React, { useState } from 'react';
import { View, StyleSheet, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';

import { Spacing, Gradients } from '../../src/core/theme/DesignSystem';
import { StatusBar } from 'expo-status-bar';
import { StreakCounter } from '../../src/features/user-stats/presentation/StreakCounter';
import MoodCheckInCard from '../../src/features/mood/presentation/MoodCheckInCard';
import { PrayerTimesCard } from '../../src/features/prayer/presentation/PrayerTimesCard';
import { DailyVerseCard } from '../../src/features/verse-of-the-day/presentation/DailyVerseCard';
import { DailyHadithCard } from '../../src/features/hadith/presentation/DailyHadithCard';
import { AdhkarScreen } from '../../src/core/presentation/screens/AdhkarScreen';
import { DashboardHeader } from '../../src/core/components/DashboardHeader';
import { KhatmaTile } from '../../src/features/khatma/presentation/KhatmaTile';
import { AdhkarTile } from '../../src/features/adhkar/presentation/AdhkarTile';

import { LinearGradient } from 'expo-linear-gradient';

const GRID_GAP = 10;
const GRID_PAD = 16;

export default function DashboardScreen() {
    const theme = useTheme();
    const [showAdhkar, setShowAdhkar] = useState(false);
    const [adhkarPeriod, setAdhkarPeriod] = useState<'morning' | 'evening' | 'night'>('morning');

    const gradientColors: readonly [string, string, ...string[]] = theme.dark
        ? [Gradients.nightSky[0], Gradients.nightSky[1]]
        : [Gradients.sereneSky[0], Gradients.sereneSky[1]];

    return (
        <View style={styles.container}>
            <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFillObject} />
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                <StatusBar style={theme.dark ? 'light' : 'dark'} />

                <DashboardHeader />
                <StreakCounter />

                {/* Dashboard cards */}
                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {/* 1. Mood Check-In */}
                    <MoodCheckInCard />


                    {/* 3. Daily Verse */}
                    <DailyVerseCard />

                    {/* 3. Daily Hadith */}
                    <DailyHadithCard />

                    {/* 4. Prayer Times */}
                    <PrayerTimesCard />

                    {/* 5. 2-Column Grid: Khatma + Adhkar */}
                    <MotiView
                        from={{ opacity: 0, translateY: 10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'spring', damping: 18, delay: 100 }}
                        style={styles.gridRow}
                    >
                        <KhatmaTile />
                        <AdhkarTile onPress={(period) => { setAdhkarPeriod(period); setShowAdhkar(true); }} />
                    </MotiView>

                    {/* Bottom padding */}
                    <View style={{ height: 120 }} />
                </ScrollView>
            </SafeAreaView>

            {/* Adhkar fullscreen modal */}
            <Modal
                visible={showAdhkar}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowAdhkar(false)}
            >
                <AdhkarScreen onClose={() => setShowAdhkar(false)} initialPeriod={adhkarPeriod} />
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    scrollView: { flex: 1 },
    scrollContent: { paddingTop: Spacing.sm, gap: Spacing.md },

    gridRow: {
        flexDirection: 'row',
        paddingHorizontal: GRID_PAD,
        gap: GRID_GAP,
        marginBottom: 0,
    },
});
