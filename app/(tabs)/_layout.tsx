import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { FloatingTabBar } from '../../src/presentation/components/navigation/FloatingTabBar';
import { GlobalMiniPlayer } from '../../src/presentation/components/audio/GlobalMiniPlayer';

export default function TabsLayout() {
    return (
        <View style={{ flex: 1 }}>
            <Tabs
                tabBar={(props) => <FloatingTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                }}>
                <Tabs.Screen
                    name="index"
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
