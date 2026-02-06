import React, { useMemo } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, G } from 'react-native-svg';
import { useTheme } from 'react-native-paper';

interface NoorMascotProps {
    size?: number;
    mood?: 'calm' | 'happy' | 'reading' | 'celebrating';
    animate?: boolean;
    style?: ViewStyle;
}

export const NoorMascot = ({
    size = 100,
    mood = 'calm',
    animate = true,
    style,
}: NoorMascotProps) => {
    const theme = useTheme();
    const isDark = theme.dark;

    const coreColor = isDark ? '#7B9EFF' : '#5B7FFF';
    const glowColor = isDark ? 'rgba(123, 158, 255, 0.3)' : 'rgba(91, 127, 255, 0.2)';
    const goldAccent = '#D4A853';

    const getEyeProps = () => {
        switch (mood) {
            case 'happy':
                return { closed: true };
            case 'reading':
                return { lookingDown: true };
            case 'celebrating':
                return { wide: true };
            default:
                return { calm: true };
        }
    };

    const eyeProps = getEyeProps();

    // Stable animation values to prevent re-renders
    const floatAnimation = useMemo(() => ({
        translateY: animate ? [0, -8, 0] : 0,
        scale: animate ? [1, 1.02, 1] : 1,
    }), [animate]);

    const floatTransition = useMemo(() => ({
        type: 'timing' as const,
        duration: 3000,
        loop: animate, // Only loop when animate is true
    }), [animate]);

    return (
        <MotiView
            key={`mascot-${animate}`} // Stable key to prevent unnecessary re-renders
            from={{ translateY: 0, scale: 1 }}
            animate={animate ? floatAnimation : { translateY: 0, scale: 1 }}
            transition={floatTransition}
            style={[styles.container, { width: size, height: size }, style]}>
            {[1.6, 1.3, 1.1].map((scale, index) => (
                <MotiView
                    key={`glow-${index}-${animate}`}
                    from={{ opacity: 0.1, scale: scale * 0.9 }}
                    animate={animate ? {
                        opacity: [0.1, 0.2, 0.1],
                        scale: [scale * 0.9, scale, scale * 0.9],
                    } : { opacity: 0.15, scale: scale * 0.95 }}
                    transition={{
                        type: 'timing',
                        duration: 2000 + index * 500,
                        loop: animate, // Only loop when animate is true
                        delay: index * 200,
                    }}
                    style={[
                        styles.glowRing,
                        {
                            width: size * scale,
                            height: size * scale,
                            borderRadius: (size * scale) / 2,
                            backgroundColor: glowColor,
                        },
                    ]}
                />
            ))}

            <View
                style={[
                    styles.orb,
                    { width: size * 0.8, height: size * 0.8, borderRadius: size * 0.4 },
                ]}>
                <LinearGradient
                    colors={[coreColor, isDark ? '#5B7FFF' : '#7B5FFF']}
                    start={{ x: 0.3, y: 0 }}
                    end={{ x: 0.7, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                />

                <View
                    style={[
                        styles.reflection,
                        {
                            width: size * 0.3,
                            height: size * 0.15,
                            borderRadius: size * 0.1,
                            top: size * 0.12,
                            left: size * 0.15,
                        },
                    ]}
                />

                <Svg width={size * 0.5} height={size * 0.4} viewBox="0 0 50 40" style={styles.face}>
                    {/* Eyes */}
                    {eyeProps.closed ? (
                        <G>
                            <Path
                                d="M 10 15 Q 15 10, 20 15"
                                stroke="#FFFFFF"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                fill="none"
                            />
                            <Path
                                d="M 30 15 Q 35 10, 40 15"
                                stroke="#FFFFFF"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                fill="none"
                            />
                        </G>
                    ) : eyeProps.lookingDown ? (
                        <G>
                            <Circle cx="15" cy="18" r="4" fill="#FFFFFF" />
                            <Circle cx="35" cy="18" r="4" fill="#FFFFFF" />
                        </G>
                    ) : mood === 'happy' ? (
                        <G>
                            {/* Smiling/Curved Eyes for happy mode */}
                            <Path
                                d="M 12 18 Q 15 14, 18 18"
                                stroke="#FFFFFF"
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                            />
                            <Path
                                d="M 32 18 Q 35 14, 38 18"
                                stroke="#FFFFFF"
                                strokeWidth="3"
                                strokeLinecap="round"
                                fill="none"
                            />
                        </G>
                    ) : eyeProps.wide ? (
                        <G>
                            <Circle cx="15" cy="15" r="5" fill="#FFFFFF" />
                            <Circle cx="35" cy="15" r="5" fill="#FFFFFF" />
                            <Circle cx="15" cy="14" r="2" fill={coreColor} />
                            <Circle cx="35" cy="14" r="2" fill={coreColor} />
                        </G>
                    ) : (
                        <G>
                            <Circle cx="15" cy="15" r="4" fill="#FFFFFF" />
                            <Circle cx="35" cy="15" r="4" fill="#FFFFFF" />
                        </G>
                    )}

                    {/* Mouth - Simple Smile */}
                    <Path
                        d="M 20 28 Q 25 32, 30 28"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                        opacity={mood === 'happy' ? 1 : 0.6}
                    />
                </Svg>

                <View
                    style={[
                        styles.hatContainer,
                        {
                            top: -size * 0.12, // Lowered to cover more of the head
                            width: size * 0.95, // Even wider to wrap around
                            height: size * 0.45, // Taller and fuller
                        },
                    ]}>
                    <Svg width="100%" height="100%" viewBox="0 0 80 35">
                        <Path
                            d="M 5 28 Q 5 2 40 2 Q 75 2 75 28 L 75 35 L 5 35 Z"
                            fill="#FFFFFF"
                            fillOpacity="0.98"
                        />
                        <Path
                            d="M 15 18 L 20 14 L 25 18 L 30 14 L 35 18 L 40 14 L 45 18 L 50 14 L 55 18 L 60 14 L 65 18"
                            stroke={coreColor}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            fill="none"
                            opacity="0.4"
                        />
                        <Path
                            d="M 5 32 L 75 32"
                            stroke={goldAccent}
                            strokeWidth="3"
                            strokeLinecap="round"
                            opacity="0.8"
                        />
                    </Svg>
                </View>
            </View>

            {mood === 'celebrating' && (
                <>
                    {[0, 1, 2, 3].map(i => (
                        <MotiView
                            key={i}
                            from={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
                            transition={{
                                type: 'timing',
                                duration: 1000,
                                loop: true,
                                delay: i * 250,
                            }}
                            style={[
                                styles.sparkle,
                                {
                                    left: size * 0.5 + Math.cos((i * Math.PI) / 2) * size * 0.6,
                                    top: size * 0.5 + Math.sin((i * Math.PI) / 2) * size * 0.6,
                                    backgroundColor: goldAccent,
                                },
                            ]}
                        />
                    ))}
                </>
            )}

            {mood === 'reading' && (
                <View style={[styles.crescentContainer, { right: -size * 0.1, top: size * 0.1 }]}>
                    <Svg width={size * 0.3} height={size * 0.3} viewBox="0 0 30 30">
                        <Path d="M 15 2 A 13 13 0 1 1 15 28 A 10 10 0 1 0 15 2" fill={goldAccent} />
                    </Svg>
                </View>
            )}
        </MotiView>
    );
};

const styles = StyleSheet.create({
    container: { alignItems: 'center', justifyContent: 'center' },
    glowRing: { position: 'absolute' },
    orb: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    reflection: {
        position: 'absolute',
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        transform: [{ rotate: '-20deg' }],
    },
    face: { position: 'absolute' },
    hatContainer: { position: 'absolute', alignItems: 'center' },
    sparkle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
    crescentContainer: { position: 'absolute' },
});

export default NoorMascot;
