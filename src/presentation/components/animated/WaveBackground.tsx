/**
 * WaveBackground - Animated liquid wave background
 *
 * Creates a serene, calming background with multiple animated waves
 * Similar to Calm/Headspace meditation apps
 *
 * Features:
 * - Multiple layers of waves with different speeds
 * - Gradient sky background
 * - Smooth infinite animation
 * - Dark mode support
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    interpolate,
} from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';
import { Gradients } from '../../theme/DesignSystem';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface WaveBackgroundProps {
    children?: React.ReactNode;
    variant?: 'serene' | 'golden' | 'night' | 'spiritual';
    intensity?: 'subtle' | 'medium' | 'full';
    style?: ViewStyle;
}

// Generate smooth wave path
const generateWavePath = (
    width: number,
    height: number,
    amplitude: number,
    frequency: number,
    phase: number,
) => {
    const waveHeight = height * 0.6;
    let path = `M 0 ${waveHeight}`;

    for (let x = 0; x <= width; x += 10) {
        const y = waveHeight + Math.sin((x / width) * frequency * Math.PI + phase) * amplitude;
        path += ` L ${x} ${y}`;
    }

    path += ` L ${width} ${height} L 0 ${height} Z`;
    return path;
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WaveLayerProps {
    color: string;
    opacity: number;
    speed: number; // Duration in ms
    amplitude: number;
    frequency: number;
    height: number;
}

const WaveLayer = ({ color, opacity, speed, amplitude, frequency, height }: WaveLayerProps) => {
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(1, { duration: speed, easing: Easing.linear }),
            -1,
            false,
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [
                {
                    translateX: interpolate(progress.value, [0, 1], [0, -SCREEN_WIDTH]),
                },
            ],
        };
    });

    // Generate wave path with double width for seamless loop
    const wavePath = generateWavePath(SCREEN_WIDTH * 2, height, amplitude, frequency, 0);

    return (
        <Animated.View style={[styles.waveContainer, animatedStyle]}>
            <Svg width={SCREEN_WIDTH * 2} height={height} style={styles.svg}>
                <Path d={wavePath} fill={color} fillOpacity={opacity} />
            </Svg>
        </Animated.View>
    );
};

export const WaveBackground = ({
    children,
    variant = 'serene',
    intensity = 'medium',
    style,
}: WaveBackgroundProps) => {
    const theme = useTheme();
    const isDark = theme.dark;

    // Color schemes for different variants
    const colorSchemes = {
        serene: {
            gradient: isDark ? Gradients.nightSky : Gradients.sereneSky,
            waves: isDark ? ['#5B7FFF', '#7B9EFF', '#9BB5FF'] : ['#5B7FFF', '#7B9EFF', '#B8C9FF'],
        },
        golden: {
            gradient: isDark ? ['#1F1A14', '#140F0A'] : Gradients.calmSunset,
            waves: isDark ? ['#D4A853', '#E5B969', '#F0CB7D'] : ['#D4A853', '#E5C387', '#F0D9A8'],
        },
        spiritual: {
            gradient: isDark ? Gradients.cosmic : Gradients.lavender,
            waves: isDark ? ['#7C3AED', '#8B5CF6', '#A78BFA'] : ['#A78BFA', '#C4B5FD', '#DDD6FE'],
        },
        night: {
            gradient: Gradients.nightSky,
            waves: ['#5B7FFF', '#4B6EDD', '#3A5DBB'],
        },
    };

    const { gradient, waves } = colorSchemes[variant];

    // Intensity affects opacity
    const opacityMultiplier = {
        subtle: 0.08,
        medium: 0.15,
        full: 0.25,
    }[intensity];

    return (
        <View style={[styles.container, style]}>
            {/* Gradient background */}
            <LinearGradient
                colors={gradient as [string, string, ...string[]]}
                style={StyleSheet.absoluteFillObject}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            />

            {/* Wave layers */}
            <View style={styles.wavesContainer}>
                {/* Back wave - slowest, most transparent */}
                <WaveLayer
                    color={waves[2]}
                    opacity={opacityMultiplier * 0.6}
                    speed={12000}
                    amplitude={30}
                    frequency={2}
                    height={200}
                />

                {/* Middle wave */}
                <WaveLayer
                    color={waves[1]}
                    opacity={opacityMultiplier * 0.8}
                    speed={8000}
                    amplitude={20}
                    frequency={2.5}
                    height={180}
                />

                {/* Front wave - fastest, most visible */}
                <WaveLayer
                    color={waves[0]}
                    opacity={opacityMultiplier}
                    speed={5000}
                    amplitude={15}
                    frequency={3}
                    height={160}
                />
            </View>

            {/* Content */}
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    wavesContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        overflow: 'hidden',
    },
    waveContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: SCREEN_WIDTH * 2,
    },
    svg: {
        position: 'absolute',
        bottom: 0,
    },
});

export default WaveBackground;
