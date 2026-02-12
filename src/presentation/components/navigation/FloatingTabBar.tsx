/**
 * FloatingTabBar — Dark pill-shaped floating tab bar
 * Inspired by Calm/fitness app design: icon-only, dark container, press animations
 */
import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from 'react-native-paper';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
} from 'react-native-reanimated';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

// Tab icon configuration
const TAB_ICONS: Record<string, {
    library: 'ionicons' | 'material';
    active: string;
    inactive: string;
}> = {
    index: { library: 'ionicons', active: 'book', inactive: 'book-outline' },
    library: { library: 'ionicons', active: 'library', inactive: 'library-outline' },
    khatma: { library: 'material', active: 'book-open-page-variant', inactive: 'book-open-page-variant-outline' },
    insights: { library: 'ionicons', active: 'stats-chart', inactive: 'stats-chart-outline' },
};

// Theme-adaptive pill backgrounds
const PILL_BG_LIGHT = '#1C1C1E';                   // Solid dark on light screens
const PILL_BG_DARK = 'rgba(60, 60, 67, 0.85)';    // Translucent lighter grey on dark screens
const ICON_SIZE = 24;
const ACTIVE_DOT_SIZE = 4;

interface TabButtonProps {
    routeName: string;
    isFocused: boolean;
    onPress: () => void;
    onLongPress: () => void;
    activeColor: string;
    inactiveColor: string;
}

function TabButton({ routeName, isFocused, onPress, onLongPress, activeColor, inactiveColor }: TabButtonProps) {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.85, { damping: 15, stiffness: 400 });
    };

    const handlePressOut = () => {
        scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    };

    const iconConfig = TAB_ICONS[routeName];
    if (!iconConfig) return null;

    const iconName = isFocused ? iconConfig.active : iconConfig.inactive;
    const iconColor = isFocused ? activeColor : inactiveColor;

    return (
        <Pressable
            onPress={onPress}
            onLongPress={onLongPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            style={styles.tabButton}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
        >
            <Animated.View style={[styles.tabIconContainer, animatedStyle]}>
                {iconConfig.library === 'material' ? (
                    <MaterialCommunityIcons
                        name={iconName as any}
                        size={ICON_SIZE}
                        color={iconColor}
                    />
                ) : (
                    <Ionicons
                        name={iconName as any}
                        size={ICON_SIZE}
                        color={iconColor}
                    />
                )}
                {/* Active indicator dot */}
                {isFocused && (
                    <View style={[styles.activeDot, { backgroundColor: activeColor }]} />
                )}
            </Animated.View>
        </Pressable>
    );
}

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const insets = useSafeAreaInsets();
    const theme = useTheme();

    // Filter to only show tabs that have icons configured (visible tabs)
    const visibleRoutes = state.routes.filter(route => TAB_ICONS[route.name]);

    const activeColor = '#FFFFFF';
    const inactiveColor = 'rgba(255, 255, 255, 0.4)';

    const pillBg = theme.dark ? PILL_BG_DARK : PILL_BG_LIGHT;

    return (
        <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
                {visibleRoutes.map((route) => {
                    const realIndex = state.routes.indexOf(route);
                    const isFocused = state.index === realIndex;

                    const onPress = () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });

                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name);
                        }
                    };

                    const onLongPress = () => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
                    };

                    return (
                        <TabButton
                            key={route.key}
                            routeName={route.name}
                            isFocused={isFocused}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            activeColor={activeColor}
                            inactiveColor={inactiveColor}
                        />
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        pointerEvents: 'box-none',
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        // backgroundColor applied dynamically via theme
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 12,
        gap: 4,
        // Subtle shadow
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
            },
            android: {
                elevation: 12,
            },
        }),
    },
    tabButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabIconContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    activeDot: {
        width: ACTIVE_DOT_SIZE,
        height: ACTIVE_DOT_SIZE,
        borderRadius: ACTIVE_DOT_SIZE / 2,
    },
});
