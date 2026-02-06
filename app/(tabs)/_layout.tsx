import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Shadows } from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

export default function TabsLayout() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: theme.colors.primary,
                tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
                tabBarStyle: {
                    backgroundColor: theme.colors.surface,
                    borderTopWidth: 0,
                    paddingTop: 8,
                    paddingBottom: Math.max(insets.bottom, 8), // Safe area or minimum padding
                    height: 60 + Math.max(insets.bottom - 8, 0), // Adjust height for safe area
                    ...Shadows.sm,
                },
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '600',
                },
                tabBarItemStyle: {
                    paddingVertical: 4,
                },
            }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Read',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'book' : 'book-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
                listeners={{
                    tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                }}
            />
            <Tabs.Screen
                name="library"
                options={{
                    title: 'Library',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'library' : 'library-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
                listeners={{
                    tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                }}
            />
            <Tabs.Screen
                name="insights"
                options={{
                    title: 'Insights',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'stats-chart' : 'stats-chart-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
                listeners={{
                    tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, size, focused }) => (
                        <Ionicons
                            name={focused ? 'settings' : 'settings-outline'}
                            size={22}
                            color={color}
                        />
                    ),
                }}
                listeners={{
                    tabPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
                }}
            />
            {/* Hide old screens */}
            <Tabs.Screen name="notes" options={{ href: null }} />
            <Tabs.Screen name="recordings" options={{ href: null }} />
        </Tabs>
    );
}
