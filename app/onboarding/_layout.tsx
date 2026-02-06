import { Stack } from 'expo-router';

export default function OnboardingLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                animation: 'fade',
                gestureEnabled: false, // Prevent back gesture during onboarding
            }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="pick-surah" />
            <Stack.Screen name="listen" />
            <Stack.Screen name="reciter" />
            <Stack.Screen name="record" />
            <Stack.Screen name="follow-along" />
            <Stack.Screen name="note" />
            <Stack.Screen name="library-tour" />
            <Stack.Screen name="folders" />
            <Stack.Screen name="premium" />
        </Stack>
    );
}
