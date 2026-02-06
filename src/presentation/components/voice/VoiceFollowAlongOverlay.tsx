import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, IconButton, useTheme, Surface } from 'react-native-paper';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

interface VoiceFollowAlongOverlayProps {
    visible: boolean;
    isListening: boolean;
    transcript: string;
    matchConfidence: number;
    onStop: () => void;
}

export const VoiceFollowAlongOverlay: React.FC<VoiceFollowAlongOverlayProps> = ({
    visible,
    isListening,
    transcript,
    matchConfidence,
    onStop,
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const getConfidenceColor = () => {
        if (matchConfidence > 0.8) return theme.colors.primary; // Great match
        if (matchConfidence > 0.5) return '#FFA500'; // Partial match
        return theme.colors.error; // No match
    };

    const getConfidenceText = () => {
        if (matchConfidence > 0.8) return '✓ Great!';
        if (matchConfidence > 0.5) return '~ Close';
        return transcript ? '✗ Try again' : 'Recite to follow along...';
    };

    return (
        <View style={styles.container}>
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
                        style={{ color: getConfidenceColor(), fontWeight: '600' }}
                        numberOfLines={1}
                        ellipsizeMode="tail">
                        {getConfidenceText()}
                    </Text>
                    {/* Show live transcript for feedback */}
                    {transcript ? (
                        <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurface, marginTop: 4, fontFamily: 'System' }}
                            numberOfLines={2}
                            ellipsizeMode="head">
                            "{transcript.slice(-100)}"
                        </Text>
                    ) : (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 4 }}>
                            Listening...
                        </Text>
                    )}
                </View>

                <IconButton
                    icon="stop-circle-outline"
                    iconColor={theme.colors.error}
                    size={32}
                    onPress={onStop}
                    style={styles.stopButton}
                />
            </Surface>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 90, // Positioned above the audio player
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
