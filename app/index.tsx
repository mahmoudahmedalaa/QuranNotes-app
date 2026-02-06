import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator } from 'react-native';
import { useOnboarding } from '../src/infrastructure/onboarding/OnboardingContext';

export default function Index() {
    const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
    const { shouldShowOnboarding, loading: onboardingLoading } = useOnboarding();

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
    if (hasSeenWelcome === null || onboardingLoading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    // Redirect based on welcome and onboarding status
    if (!hasSeenWelcome) {
        return <Redirect href="/welcome" />;
    }

    // Show onboarding for users who haven't completed it
    if (shouldShowOnboarding) {
        return <Redirect href="/onboarding" />;
    }

    return <Redirect href="/(tabs)" />;
}
