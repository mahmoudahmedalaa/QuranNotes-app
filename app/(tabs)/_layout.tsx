import { View } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/core/navigation/FloatingTabBar';
import { GlobalMiniPlayer } from '../../src/features/audio-player/presentation/GlobalMiniPlayer';
import { useSubscriptionAccess } from '../../src/features/payments/infrastructure/useSubscriptionAccess';

export default function TabsLayout() {
    const { isLoading, requiresSubscription } = useSubscriptionAccess();

    if (!isLoading && requiresSubscription) {
        return <Redirect href={'/paywall?hard=1' as any} />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: 'transparent' }}>
            <Tabs
                tabBar={(props) => <FloatingTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                    sceneStyle: { backgroundColor: 'transparent' } // Ensures the underlying layout is visible
                }}>
                <Tabs.Screen
                    name="index"
                    options={{ title: 'Home' }}
                />
                <Tabs.Screen
                    name="read"
                    options={{ title: 'Read' }}
                />
                <Tabs.Screen
                    name="library"
                    options={{ title: 'Library' }}
                />
                <Tabs.Screen
                    name="khatma"
                    options={{ title: 'Khatma' }}
                />
                <Tabs.Screen
                    name="insights"
                    options={{ title: 'Insights' }}
                />
                {/* Hidden screens — accessible via router.push but not in tab bar */}
                <Tabs.Screen name="settings" options={{ href: null }} />
                <Tabs.Screen name="notes" options={{ href: null }} />
                <Tabs.Screen name="recordings" options={{ href: null }} />
            </Tabs>
            <GlobalMiniPlayer />
        </View>
    );
}
