import { NoteProvider } from '../src/infrastructure/notes/NoteContext';
import { SettingsProvider } from '../src/infrastructure/settings/SettingsContext';
import { FolderProvider } from '../src/infrastructure/notes/FolderContext';
import { StreakProvider } from '../src/infrastructure/auth/StreakContext';
import { OnboardingProvider } from '../src/infrastructure/onboarding/OnboardingContext';
import { AuthProvider } from '../src/infrastructure/auth/AuthContext';
import { ProProvider } from '../src/infrastructure/auth/ProContext';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PremiumTheme } from '../src/presentation/theme/DesignSystem';
import { RepositoryProvider } from '../src/infrastructure/di/RepositoryContext';
import Toast from 'react-native-toast-message';

export default function RootLayout() {
    return (
        <>
            <RepositoryProvider>
                <AuthProvider>
                    <ProProvider>
                        <OnboardingProvider>
                            <StreakProvider>
                                <SettingsProvider>
                                    <NoteProvider>
                                        <FolderProvider>
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
                                            </Stack>
                                        </FolderProvider>
                                    </NoteProvider>
                                </SettingsProvider>
                            </StreakProvider>
                        </OnboardingProvider>
                    </ProProvider>
                </AuthProvider>
            </RepositoryProvider>
            <Toast
                topOffset={80}
                visibilityTime={5000}
            />
        </>
    );
}
