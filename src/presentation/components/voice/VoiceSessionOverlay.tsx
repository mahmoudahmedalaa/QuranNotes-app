import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, IconButton, useTheme, Surface } from 'react-native-paper';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

interface VoiceSessionOverlayProps {
    visible: boolean;
    isListening: boolean;
    transcript: string;
    onStop: () => void;
}

export const VoiceSessionOverlay: React.FC<VoiceSessionOverlayProps> = ({
    visible,
    isListening,
    transcript,
    onStop,
}) => {
    const theme = useTheme();
    const slideAnim = useRef(new Animated.Value(100)).current;

    useEffect(() => {
        Animated.spring(slideAnim, {
            toValue: visible ? 0 : 100,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
        }).start();
    }, [visible, slideAnim]);

    if (!visible) return null;

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
            <Surface
                style={[styles.surface, { backgroundColor: theme.colors.elevation.level3 }]}
                elevation={4}>
                <View style={styles.indicatorContainer}>
                    <View
                        style={[
                            styles.indicator,
                            {
                                backgroundColor: isListening
                                    ? theme.colors.error
                                    : theme.colors.outline,
                            },
                        ]}
                    />
                    <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {isListening ? 'Listening...' : 'Paused'}
                    </Text>
                </View>

                <View style={styles.transcriptContainer}>
                    <Text
                        variant="bodyMedium"
                        style={{ color: theme.colors.onSurface }}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {transcript || 'Recite to follow along...'}
                    </Text>
                </View>

                <IconButton
                    icon="stop-circle-outline"
                    iconColor={theme.colors.error}
                    size={32}
                    onPress={onStop}
                    style={styles.stopButton}
                />
            </Surface>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 90, // Positioned above the audio player (which is usually at bottom 0-80)
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 1000,
    },
    surface: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.lg,
        ...Shadows.md,
    },
    indicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginRight: Spacing.md,
    },
    indicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    transcriptContainer: {
        flex: 1,
        marginRight: Spacing.sm,
    },
    stopButton: {
        margin: 0,
    },
});
