import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { useOnboarding } from '../src/infrastructure/onboarding/OnboardingContext';
import { useAuth } from '../src/infrastructure/auth/AuthContext';

export default function Index() {
    const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
    const { shouldShowOnboarding, loading: onboardingLoading } = useOnboarding();
    const { user, loading: authLoading } = useAuth();

    useEffect(() => {
        checkWelcomeStatus();
    }, []);

    const checkWelcomeStatus = async () => {
        try {
            const value = await AsyncStorage.getItem('hasSeenWelcome');
            setHasSeenWelcome(value === 'true');
        } catch (error) {
            // If error, show welcome screen
            setHasSeenWelcome(false);
        }
    };

    // Check if there is an initial URL (Deep Link) that needs handling
    // We only enforce our logic if the user is hitting the root ('/')
    // If they are deep linking (e.g. /verify-email), we should let router handle it?
    // Actually, Expo Router handles deep links by matching the path. 
    // If the path matches 'index', this component renders.
    // So we effectively guard the root.

    // Loading state
    if (hasSeenWelcome === null || onboardingLoading || authLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // 1. New User -> Welcome Screen (Mascot)
    if (!hasSeenWelcome) {
        return <Redirect href="/welcome" />;
    }

    // 2. Not Signed In -> Auth Flow (Login/Signup)
    if (!user) {
        return <Redirect href="/(auth)/login" />;
    }

    // 3. Not Completed Onboarding -> Onboarding Flow (Wait, we will handle this via login.tsx logic too, but keep it here for new users)
    if (shouldShowOnboarding) {
        return <Redirect href="/onboarding" />;
    }

    // 4. Everything Done -> Home (Tabs)
    return <Redirect href="/(tabs)" />;
}
