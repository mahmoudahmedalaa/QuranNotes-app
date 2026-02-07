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

    // Loading state
    if (hasSeenWelcome === null || onboardingLoading || authLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // 1. Not Completed Onboarding -> Onboarding Flow
    if (shouldShowOnboarding) {
        return <Redirect href="/onboarding" />;
    }

    // 2. New User -> Welcome Screen
    if (!hasSeenWelcome) {
        return <Redirect href="/welcome" />;
    }

    // 3. Not Signed In -> Auth Flow (Login/Signup)
    if (!user) {
        return <Redirect href="/(auth)/login" />;
    }

    // 4. Everything Done -> Home (Tabs)
    return <Redirect href="/(tabs)" />;
}
