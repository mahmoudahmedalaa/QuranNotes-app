/**
 * NoorAIButton — Compact "Ask Noor AI" card for the dashboard.
 *
 * Implements a premium "motion.dev" style interactive animated border.
 * A rotating linear gradient acts as a light beam sweeping across the border.
 */

import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolateColor,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius } from '../theme/DesignSystem';

interface Props {
    onPress: () => void;
}

const PURPLE = '#6246EA';
const PURPLE_LIGHT = '#A78BFA';

export function NoorAIButton({ onPress }: Props) {
    const theme = useTheme();
    const isDark = theme.dark;

    // Outer glow / interactive state
    const scale = useSharedValue(1);
    const rotation = useSharedValue(0);
    const pulse = useSharedValue(0);

    useEffect(() => {
        // Continuous rotation for the border beam (0 to 360 deg)
        rotation.value = withRepeat(
            withTiming(360, { duration: 4000, easing: Easing.linear }),
            -1, // infinite
            false
        );

        // Gentle pulse for the live dot
        pulse.value = withRepeat(
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            -1,
            true
        );
    }, [rotation, pulse]);

    const animatedBorderRotation = useAnimatedStyle(() => {
        return {
            transform: [
                { rotate: `${rotation.value}deg` },
            ],
        };
    });

    const animatedScale = useAnimatedStyle(() => {
        return {
            transform: [{ scale: scale.value }],
        };
    });

    const animatedLiveDot = useAnimatedStyle(() => {
        const bgColor = interpolateColor(
            pulse.value,
            [0, 1],
            ['rgba(167, 139, 250, 0.4)', 'rgba(167, 139, 250, 1)']
        );
        return {
            backgroundColor: bgColor,
            transform: [{ scale: 0.8 + pulse.value * 0.4 }],
        };
    });

    const handlePressIn = () => {
        scale.value = withTiming(0.97, { duration: 150, easing: Easing.out(Easing.ease) });
    };

    const handlePressOut = () => {
        scale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
    };

    const bgColor = isDark ? '#141424' : '#F8F9FA'; // Slightly distinct background
    const innerBgColor = isDark ? '#1E1E32' : '#FFFFFF';
    const borderColor = isDark ? 'rgba(167, 139, 250, 0.15)' : 'rgba(98, 70, 234, 0.2)';

    return (
        <Pressable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            hitSlop={6}
        >
            <Animated.View style={[styles.outerContainer, animatedScale, { shadowColor: PURPLE }]}>
                {/* 1. Clipping container for standard border radius */}
                <View style={[
                    styles.borderWrapper,
                    {
                        backgroundColor: bgColor,
                        borderColor: borderColor,
                    }
                ]}>

                    {/* 2. Rotating beam (much larger than container to spin from center) */}
                    <Animated.View style={[
                        styles.rotatingBeamContainer,
                        animatedBorderRotation
                    ]}>
                        <LinearGradient
                            colors={[
                                'transparent',
                                isDark ? 'rgba(167, 139, 250, 0.6)' : 'rgba(98, 70, 234, 0.6)',
                                'transparent',
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.rotatingBeam}
                        />
                    </Animated.View>

                    {/* 3. Inner Card (Leaves exactly 1.5px gap to reveal the beam underneath) */}
                    <View style={[styles.innerContent, { backgroundColor: innerBgColor }]}>

                        {/* Left: icon with gradient bg */}
                        <LinearGradient
                            colors={isDark
                                ? ['rgba(167, 139, 250, 0.15)', 'rgba(98, 70, 234, 0.08)'] as const
                                : ['rgba(98, 70, 234, 0.1)', 'rgba(167, 139, 250, 0.06)'] as const
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.iconContainer}
                        >
                            <MaterialCommunityIcons
                                name="creation"
                                size={18}
                                color={isDark ? PURPLE_LIGHT : PURPLE}
                            />
                        </LinearGradient>

                        {/* Center: text */}
                        <View style={styles.textContainer}>
                            <Text style={[styles.title, { color: isDark ? '#E8E0FF' : PURPLE }]}>
                                Ask Noor AI
                            </Text>
                            <Text style={[styles.subtitle, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]}>
                                Your Quran companion
                            </Text>
                        </View>

                        {/* Right: live indicator dot + chevron */}
                        <View style={styles.rightSide}>
                            <Animated.View style={[styles.liveDot, animatedLiveDot]} />
                            <MaterialCommunityIcons
                                name="chevron-right"
                                size={20}
                                color={isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)'}
                            />
                        </View>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    outerContainer: {
        borderRadius: BorderRadius.lg,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
    },
    borderWrapper: {
        overflow: 'hidden',
        borderRadius: BorderRadius.lg,
        borderWidth: 1, // Subtle static border to define the shape when beam isn't there
        position: 'relative',
    },
    rotatingBeamContainer: {
        position: 'absolute',
        top: '-150%',
        bottom: '-150%',
        left: '-50%',
        right: '-50%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rotatingBeam: {
        width: '100%',
        height: '40%', // Width of the beam across the card
    },
    innerContent: {
        margin: 1.5, // MAGIC NUMBER: 1.5px border where beam leaks through
        borderRadius: BorderRadius.lg - 1, // slightly smaller radius to match perfectly
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        flex: 1,
        marginLeft: 12,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    subtitle: {
        fontSize: 12,
        marginTop: 1,
    },
    rightSide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
});
