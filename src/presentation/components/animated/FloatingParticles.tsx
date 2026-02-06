/**
 * FloatingParticles - Ambient floating particles for meditation feel
 *
 * Creates subtle, gentle floating particles that add depth and serenity
 * Like dust motes in sunlight or stars in the night sky
 */

import React, { useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';
import { MotiView } from 'moti';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FloatingParticlesProps {
    count?: number;
    color?: string;
    maxSize?: number;
    minSize?: number;
}

interface ParticleProps {
    x: number;
    y: number;
    size: number;
    duration: number;
    delay: number;
    color: string;
}

const Particle = ({ x, y, size, duration, delay, color }: ParticleProps) => {
    return (
        <MotiView
            from={{
                opacity: 0,
                translateY: 0,
                scale: 0.5,
            }}
            animate={{
                opacity: [0, 0.6, 0.6, 0],
                translateY: [-20, -100],
                scale: [0.5, 1, 0.8],
            }}
            transition={{
                type: 'timing',
                duration: duration,
                delay: delay,
                loop: true,
                repeatReverse: false,
                easing: Easing.inOut(Easing.ease),
            }}
            style={[
                styles.particle,
                {
                    left: x,
                    top: y,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                },
            ]}
        />
    );
};

export const FloatingParticles = ({
    count = 15,
    color,
    maxSize = 6,
    minSize = 2,
}: FloatingParticlesProps) => {
    const theme = useTheme();
    const particleColor =
        color || (theme.dark ? 'rgba(123, 158, 255, 0.5)' : 'rgba(91, 127, 255, 0.3)');

    // Generate random particle data once
    const particles = useMemo(() => {
        return Array.from({ length: count }, (_, i) => ({
            id: i,
            x: Math.random() * SCREEN_WIDTH,
            y: Math.random() * SCREEN_HEIGHT * 0.7 + SCREEN_HEIGHT * 0.2,
            size: Math.random() * (maxSize - minSize) + minSize,
            duration: Math.random() * 4000 + 6000, // 6-10 seconds
            delay: Math.random() * 5000, // 0-5 seconds initial delay
        }));
    }, [count, maxSize, minSize]);

    return (
        <View style={styles.container} pointerEvents="none">
            {particles.map(particle => (
                <Particle
                    key={particle.id}
                    x={particle.x}
                    y={particle.y}
                    size={particle.size}
                    duration={particle.duration}
                    delay={particle.delay}
                    color={particleColor}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        overflow: 'hidden',
    },
    particle: {
        position: 'absolute',
    },
});

export default FloatingParticles;
