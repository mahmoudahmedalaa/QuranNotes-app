/**
 * QiblaHeaderIndicator — 28pt mini compass for the DashboardHeader.
 * Tapping it opens the full-screen Qibla overlay.
 *
 * Shows a live animated compass when sensors are available (physical device),
 * or a static compass icon as a fallback (simulator / no permissions).
 */
import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useQibla } from '../hooks/useQibla';
import { usePrayer } from '../infrastructure/PrayerContext';
import { QiblaFullScreen } from './QiblaFullScreen';
import { VioletPalette, BrandTokens } from '../../../core/theme/DesignSystem';

const SIZE = 28;
const NEEDLE = 9;
const STROKE = 1.5;

export const QiblaHeaderIndicator: React.FC = () => {
    const theme = useTheme();
    const { userLocation, locationError } = usePrayer();
    const [showFullScreen, setShowFullScreen] = useState(false);
    const {
        qiblaRotation,
        isAvailable,
    } = useQibla({ enabled: true });

    const isDark = theme.dark;
    const ringColor = isDark ? VioletPalette.softLavender : VioletPalette.wisteria;
    const needleColor = isDark ? BrandTokens.dark.accentPrimary : BrandTokens.light.accentPrimary;

    // ALL hooks must be called before any conditional returns (React rules of hooks)
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${qiblaRotation.value}deg` }],
    }));

    // Determine if we have live sensor data
    const hasLiveSensor = !!userLocation && !locationError && isAvailable;

    return (
        <>
            <TouchableOpacity
                onPress={() => setShowFullScreen(true)}
                style={styles.container}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
            >
                {hasLiveSensor ? (
                    /* Live animated compass needle */
                    <Animated.View style={animatedStyle}>
                        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
                            <Circle
                                cx={SIZE / 2}
                                cy={SIZE / 2}
                                r={(SIZE - STROKE) / 2}
                                stroke={ringColor}
                                strokeWidth={STROKE}
                                fill="none"
                            />
                            <Line
                                x1={SIZE / 2}
                                y1={SIZE / 2}
                                x2={SIZE / 2}
                                y2={SIZE / 2 - NEEDLE}
                                stroke={needleColor}
                                strokeWidth={2}
                                strokeLinecap="round"
                            />
                            <Circle
                                cx={SIZE / 2}
                                cy={SIZE / 2}
                                r={2}
                                fill={needleColor}
                            />
                        </Svg>
                    </Animated.View>
                ) : (
                    /* Static fallback — always visible */
                    <MaterialCommunityIcons
                        name="compass-outline"
                        size={SIZE}
                        color={needleColor}
                    />
                )}
            </TouchableOpacity>

            <QiblaFullScreen
                visible={showFullScreen}
                onClose={() => setShowFullScreen(false)}
            />
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 2,
    },
});
