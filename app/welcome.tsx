import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Spacing, BorderRadius, Gradients } from '../src/presentation/theme/DesignSystem';
import { useOnboarding } from '../src/infrastructure/onboarding/OnboardingContext';
import { useAuth } from '../src/infrastructure/auth/AuthContext';
import { NoorMascot } from '../src/presentation/components/mascot/NoorMascot';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');

// Short Authentic Hadiths (Sahih Muslim/Bukhari)
const HADITHS = [
    { text: "The best among you is the one who learns the Quran and teaches it.", source: "— Prophet Muhammad (PBUH)" },
    { text: "Read the Quran, for it will come as an intercessor for its reciters on the Day of Resurrection.", source: "— Prophet Muhammad (PBUH)" },
    { text: "Verily the one who recites the Quran beautifully, smoothly, and precisely, he will be in the company of the noble and obedient angels.", source: "— Prophet Muhammad (PBUH)" },
    { text: "Cleanliness is half of faith.", source: "— Prophet Muhammad (PBUH)" },
    { text: "He who does not thank people, does not thank Allah.", source: "— Prophet Muhammad (PBUH)" }
];

export default function WelcomeScreen() {
    const router = useRouter();
    const theme = useTheme();
    const { shouldShowOnboarding } = useOnboarding();
    const [hadithIndex, setHadithIndex] = useState(0);

    const { user } = useAuth(); // Add user from useAuth

    // Cycle Hadith
    useEffect(() => {
        const interval = setInterval(() => {
            setHadithIndex((prev) => (prev + 1) % HADITHS.length);
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleBegin = async () => {
        // Mark that user has seen welcome screen
        await AsyncStorage.setItem('hasSeenWelcome', 'true');

        // If onboarding not completed, go to onboarding
        if (shouldShowOnboarding) {
            router.replace('/onboarding');
            return;
        }

        // If not signed in, go to functionality
        if (!user) {
            router.replace('/(auth)/login');
            return;
        }

        // Otherwise go to main app
        router.replace('/(tabs)');
    };

    return (
        <LinearGradient
            colors={theme.dark ? ['#0F1419', '#1A1F26'] : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>

                {/* 1. Noor Mascot with Happy Mood */}
                <View style={styles.mascotContainer}>
                    <NoorMascot
                        size={180}
                        mood="happy"
                        animate={true}
                    />
                </View>

                {/* 2. Content Section */}
                <View style={styles.content}>
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ delay: 500, type: 'timing', duration: 800 }}
                    >
                        <Text style={[styles.title, { color: theme.colors.primary }]}>
                            QuranNotes
                        </Text>
                        <Text style={[styles.subtitle, { color: theme.colors.secondary }]}>
                            Read. Reflect. Grow.
                        </Text>
                    </MotiView>

                    {/* 3. Hadith Carousel */}
                    <View style={styles.hadithContainer}>
                        <MotiView
                            key={hadithIndex}
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 500 }}
                        >
                            <Text style={[styles.hadithText, { color: theme.colors.onSurfaceVariant }]}>
                                "{HADITHS[hadithIndex].text}"
                            </Text>
                            <Text style={[styles.hadithSource, { color: theme.colors.primary }]}>
                                {HADITHS[hadithIndex].source}
                            </Text>
                        </MotiView>
                    </View>
                </View>

                {/* 4. Action Section */}
                <View style={styles.footer}>
                    <Button
                        mode="contained"
                        onPress={handleBegin}
                        style={styles.button}
                        contentStyle={styles.buttonContent}
                        labelStyle={styles.buttonLabel}
                    >
                        Begin Journey
                    </Button>
                </View>

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
        justifyContent: 'space-between',
        paddingVertical: Spacing.xl,
    },
    mascotContainer: {
        flex: 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 2,
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
    },
    title: {
        fontSize: 42,
        fontWeight: 'bold',
        textAlign: 'center',
        letterSpacing: -1,
        marginBottom: Spacing.xs,
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '500',
        textAlign: 'center',
        opacity: 0.8,
        marginBottom: Spacing.xxl,
    },
    hadithContainer: {
        marginTop: Spacing.lg,
        padding: Spacing.lg,
        backgroundColor: 'rgba(255,255,255,0.5)',
        borderRadius: BorderRadius.xl,
        width: '100%',
    },
    hadithText: {
        fontSize: 16,
        fontStyle: 'italic',
        textAlign: 'center',
        marginBottom: Spacing.sm,
        lineHeight: 24,
    },
    hadithSource: {
        fontSize: 12,
        fontWeight: 'bold',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    footer: {
        flex: 1,
        justifyContent: 'flex-end',
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xl,
    },
    button: {
        borderRadius: BorderRadius.xl,
        elevation: 4,
    },
    buttonContent: {
        height: 56,
    },
    buttonLabel: {
        fontSize: 18,
        fontWeight: 'bold',
        letterSpacing: 1,
    },
});
