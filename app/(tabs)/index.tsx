import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { useQuran } from '../../src/presentation/hooks/useQuran';
import { SurahList } from '../../src/presentation/components/quran/SurahList';
import { SurahPicker } from '../../src/presentation/components/common/SurahPicker';
import { WaveBackground } from '../../src/presentation/components/animated/WaveBackground';
import { FloatingParticles } from '../../src/presentation/components/animated/FloatingParticles';
import { NoorMascot } from '../../src/presentation/components/mascot/NoorMascot';
import { AnimatedButton } from '../../src/presentation/components/animated/AnimatedButton';
import { Spacing, BorderRadius, Shadows } from '../../src/presentation/theme/DesignSystem';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { StreakCounter } from '../../src/presentation/components/stats/StreakCounter';

export default function Index() {
    const { loading, error, surahList, loadSurahList } = useQuran();
    const router = useRouter();
    const theme = useTheme();
    const [pickerVisible, setPickerVisible] = useState(false);
    const [minLoading, setMinLoading] = useState(true);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [loadingAttribution, setLoadingAttribution] = useState('');

    const MESSAGES = [
        '“By the remembrance of Allah do hearts find rest.” — Prophet Muhammad (PBUH)',
        '“Allah is with those who patiently persevere.” — Prophet Muhammad (PBUH)',
        '“The best among you are those who learn the Quran.” — Prophet Muhammad (PBUH)',
        '“Peace is in the words of the Most Merciful.” — Prophet Muhammad (PBUH)',
        '“Allah is the Light of the heavens and the earth.” — Prophet Muhammad (PBUH)',
    ];

    useEffect(() => {
        loadSurahList();
        let messageIndex = 0;
        const cycleMessage = () => {
            const fullMessage = MESSAGES[messageIndex];
            const [text, attr] = fullMessage.split(' — ');
            setLoadingMessage(text);
            setLoadingAttribution(attr);
            messageIndex = (messageIndex + 1) % MESSAGES.length;
        };
        cycleMessage();
        const interval = setInterval(cycleMessage, 3500);
        // Show 2 messages (3.5s each) then dismiss
        const timer = setTimeout(() => setMinLoading(false), 7000);
        return () => {
            clearInterval(interval);
            clearTimeout(timer);
        };
    }, []);

    const isAppLoading = loading || minLoading;

    const handleSelectSurah = (number: number) => {
        router.push(`/surah/${number}`);
    };

    if (isAppLoading) {
        return (
            <WaveBackground variant="spiritual" intensity="subtle">
                <FloatingParticles count={15} />
                <View style={[styles.center, { flex: 1 }]}>
                    <NoorMascot size={120} mood="calm" />
                    <MotiView
                        key={loadingMessage} // Key triggers re-animation on message change
                        from={{ opacity: 0, translateY: 10 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        exit={{ opacity: 0, translateY: -10 }}
                        transition={{ type: 'timing', duration: 800 }} // Smooth, simple entry
                    >
                        <Text style={[styles.loadingText, { color: theme.colors.onSurface }]}>
                            {loadingMessage}
                        </Text>
                        {loadingAttribution && (
                            <Text
                                style={[
                                    styles.loadingAttribution,
                                    { color: theme.colors.outline },
                                ]}>
                                — {loadingAttribution}
                            </Text>
                        )}
                    </MotiView>
                </View>
            </WaveBackground>
        );
    }

    if (error) {
        return (
            <WaveBackground variant="spiritual" intensity="subtle">
                <View style={[styles.center, { flex: 1 }]}>
                    <NoorMascot size={120} mood="calm" />
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'spring', delay: 200 }}
                        style={styles.errorContainer}>
                        <Text style={[styles.errorText, { color: theme.colors.error }]}>
                            {error}
                        </Text>
                        <AnimatedButton
                            label="Try Again"
                            icon="refresh"
                            onPress={loadSurahList}
                            variant="primary"
                            size="md"
                        />
                    </MotiView>
                </View>
            </WaveBackground>
        );
    }

    return (
        <View style={styles.container}>
            <WaveBackground variant="spiritual" intensity="medium">
                <FloatingParticles count={20} />
                <SafeAreaView style={styles.safeArea} edges={['top']}>
                    <StatusBar style={theme.dark ? 'light' : 'dark'} />

                    {/* Premium Header */}
                    <MotiView
                        from={{ opacity: 0, translateY: -20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'spring', damping: 18, delay: 100 }}
                        style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.headerRow}>
                                <NoorMascot size={60} mood="happy" style={styles.headerMascot} />
                                <View style={styles.headerTextGroup}>
                                    <Text
                                        style={[styles.greeting, { color: theme.colors.primary }]}>
                                        Assalamualaikum
                                    </Text>
                                    <Text
                                        style={[
                                            styles.headerTitle,
                                            { color: theme.colors.onBackground },
                                        ]}>
                                        Holy Quran
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <AnimatedButton
                            label="Jump"
                            icon="book-outline"
                            onPress={() => setPickerVisible(true)}
                            variant="secondary"
                            size="sm"
                        />
                    </MotiView>

                    <StreakCounter />

                    {/* Content Area with subtle background */}
                    <MotiView
                        from={{ opacity: 0, translateY: 30 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'spring', damping: 18, delay: 200 }}
                        style={[
                            styles.listContainer,
                            { backgroundColor: theme.colors.background },
                        ]}>
                        <SurahList surahs={surahList} onSelect={handleSelectSurah} />
                    </MotiView>

                    <SurahPicker
                        visible={pickerVisible}
                        onDismiss={() => setPickerVisible(false)}
                        onSelect={handleSelectSurah}
                        surahs={surahList.map(s => ({
                            number: s.number,
                            name: s.name,
                            englishName: s.englishName,
                        }))}
                    />
                </SafeAreaView>
            </WaveBackground>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        alignItems: 'center',
        marginTop: Spacing.xl,
    },
    errorText: {
        fontSize: 16,
        marginBottom: Spacing.md,
        textAlign: 'center',
    },
    loadingText: {
        marginTop: Spacing.md,
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        paddingHorizontal: Spacing.xl,
        fontStyle: 'italic',
    },
    loadingAttribution: {
        marginTop: Spacing.sm,
        fontSize: 12,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'center',
        opacity: 0.6,
    },
    header: {
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerMascot: {
        marginRight: Spacing.md,
    },
    headerTextGroup: {
        justifyContent: 'center',
    },
    greeting: {
        fontSize: 13,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    listContainer: {
        flex: 1,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
        paddingTop: Spacing.md,
        overflow: 'hidden',
    },
});
