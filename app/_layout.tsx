import { NoteProvider } from '../src/features/notes/infrastructure/NoteContext';
import { HighlightProvider } from '../src/features/notes/infrastructure/HighlightContext';
import { SettingsProvider } from '../src/features/settings/infrastructure/SettingsContext';
import { FolderProvider } from '../src/features/notes/infrastructure/FolderContext';
import { StreakProvider } from '../src/features/auth/infrastructure/StreakContext';
import { KhatmaProvider } from '../src/features/khatma/infrastructure/KhatmaContext';
import { MoodProvider } from '../src/features/mood/infrastructure/MoodContext';
import { AudioProvider } from '../src/features/audio-player/infrastructure/AudioContext';
import { PrayerProvider } from '../src/features/prayer/infrastructure/PrayerContext';
import { AdhkarProvider } from '../src/features/adhkar/infrastructure/AdhkarContext';
import { HadithProvider } from '../src/features/hadith/infrastructure/HadithContext';
import { TadabburProvider } from '../src/features/tadabbur/infrastructure/TadabburContext';
import { AudioKhatmaBridge } from '../src/features/khatma/presentation/AudioKhatmaBridge';
import { NotificationScheduler } from '../src/features/notifications/presentation/NotificationScheduler';
import { OnboardingProvider, useOnboarding } from '../src/features/onboarding/infrastructure/OnboardingContext';
import { AuthProvider, useAuth } from '../src/features/auth/infrastructure/AuthContext';
import { ProProvider } from '../src/features/auth/infrastructure/ProContext';
import { GlobalErrorBoundary } from '../src/core/components/GlobalErrorBoundary';
import { useSync } from '../src/core/hooks/useSync';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PremiumTheme } from '../src/core/theme/DesignSystem';
import { RepositoryProvider } from '../src/core/di/RepositoryContext';
import { composeProviders } from '../src/core/utils/composeProviders';
import Toast from 'react-native-toast-message';
import { toastConfig } from '../src/core/components/feedback/toastConfig';
import { initRamadanDates } from '../src/core/utils/ramadanUtils';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { QURAN_FONTS } from '../src/core/theme/QuranFonts';

// Keep native splash visible until providers are ready — prevents the
// blank lavender + spinner flash between native splash and React UI.
SplashScreen.preventAutoHideAsync();

/**
 * All feature providers in dependency order (first = outermost).
 * This replaces the deeply nested "Provider Pyramid of Doom".
 */
const AppProviders = composeProviders([
    RepositoryProvider,
    AuthProvider,
    ProProvider,
    OnboardingProvider,
    StreakProvider,
    SettingsProvider,
    AudioProvider,
    KhatmaProvider,
    MoodProvider,
    PrayerProvider,
    AdhkarProvider,
    NoteProvider,
    HighlightProvider,
    HadithProvider,
    TadabburProvider,
    FolderProvider,
]);

/** Hides the native splash once auth + onboarding data are resolved. */
function SplashHider({ fontsLoaded }: { fontsLoaded: boolean }) {
    const { loading: authLoading } = useAuth();
    const { loading: onboardingLoading } = useOnboarding();

    useEffect(() => {
        if (!authLoading && !onboardingLoading && fontsLoaded) {
            SplashScreen.hideAsync();
        }
    }, [authLoading, onboardingLoading, fontsLoaded]);

    return null;
}

/** Runs background data sync (notes, folders, recordings for all users; cloud sync for Pro). */
function SyncManager() {
    useSync();
    return null;
}

export default function RootLayout() {
    const [fontsLoaded] = useFonts(QURAN_FONTS);

    // Fetch + listen for Ramadan dates from Firestore (real-time)
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        initRamadanDates().then((unsub) => {
            unsubscribe = unsub;
        }).catch(() => { /* silent — Ramadan dates fall back to hardcoded defaults */ });
        return () => {
            unsubscribe?.();
        };
    }, []);

    return (
        <GlobalErrorBoundary>
            <AppProviders>
                <AudioKhatmaBridge />
                <SplashHider fontsLoaded={fontsLoaded} />
                <SyncManager />
                <NotificationScheduler />
                <StatusBar style="dark" />
                <Stack
                    screenOptions={{
                        headerShown: false,
                        contentStyle: {
                            backgroundColor: PremiumTheme.colors.background,
                        },
                    }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen name="welcome" options={{ headerShown: false }} />
                    <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                    <Stack.Screen name="search" />
                    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                    <Stack.Screen
                        name="note/edit"
                        options={{ presentation: 'modal' }}
                    />
                    <Stack.Screen
                        name="paywall"
                        options={{ presentation: 'modal', headerShown: false }}
                    />
                    <Stack.Screen
                        name="ramadan-paywall"
                        options={{ presentation: 'modal', headerShown: false }}
                    />
                    <Stack.Screen
                        name="hadith-library"
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="tadabbur-session"
                        options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }}
                    />
                    <Stack.Screen
                        name="noor-ai"
                        options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'fade' }}
                    />
                    <Stack.Screen
                        name="reflections"
                        options={{ headerShown: false }}
                    />
                    <Stack.Screen
                        name="reflection-detail"
                        options={{ headerShown: false }}
                    />
                </Stack>
            </AppProviders>
            <Toast
                config={toastConfig}
                topOffset={80}
                visibilityTime={5000}
            />
        </GlobalErrorBoundary>
    );
}
