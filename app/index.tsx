import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { useOnboarding } from '../src/features/onboarding/infrastructure/OnboardingContext';
import { useAuth } from '../src/features/auth/infrastructure/AuthContext';
import { useSubscriptionAccess } from '../src/features/payments/infrastructure/useSubscriptionAccess';

export default function Index() {
    const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
    const { shouldShowOnboarding, loading: onboardingLoading } = useOnboarding();
    const { user, loading: authLoading } = useAuth();
    const { isLoading: accessLoading, requiresSubscription } = useSubscriptionAccess();

    useEffect(() => {
        checkWelcomeStatus();
    }, []);

    const checkWelcomeStatus = async () => {
        try {
            const value = await AsyncStorage.getItem('hasSeenWelcome');
            setHasSeenWelcome(value === 'true');
        } catch {
            // If error, show welcome screen
            setHasSeenWelcome(false);
        }
    };

    // Loading state — wait for all data to be ready
    if (hasSeenWelcome === null || onboardingLoading || authLoading || accessLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // 1. Not signed in -> Auth (Sign up / Login)
    if (!user) {
        return <Redirect href="/(auth)/sign-up" />;
    }

    // 2. New user who hasn't completed onboarding -> Onboarding Flow
    if (shouldShowOnboarding) {
        return <Redirect href="/onboarding" />;
    }

    // 3. Authenticated + onboarded but hasn't seen welcome -> Welcome Screen
    if (!hasSeenWelcome) {
        return <Redirect href="/welcome" />;
    }

    // 4. Authenticated + onboarded + welcomed but gated -> Hard paywall
    if (requiresSubscription) {
        return <Redirect href={'/paywall?hard=1' as any} />;
    }

    // 5. Fully authenticated + onboarded + welcomed -> Home
    return <Redirect href="/(tabs)" />;
}
