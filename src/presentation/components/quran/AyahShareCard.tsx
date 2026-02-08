/**
 * AyahShareCard — Beautiful shareable ayah card
 *
 * Displays an ayah with Arabic text, translation, and surah reference
 * in a premium design. Uses React Native's built-in Share API for
 * zero-dependency text sharing, plus a visually stunning modal
 * that users can screenshot for image sharing.
 *
 * Cost: $0 (no cloud services, no extra packages)
 * Battery: Minimal (static UI, no background processing)
 */

import React from 'react';
import { View, Text, StyleSheet, Share, Modal, Pressable, Dimensions } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Shadows, Gradients } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AyahShareCardProps {
    visible: boolean;
    onDismiss: () => void;
    arabicText: string;
    translation: string;
    surahName: string;
    surahNameArabic: string;
    verseNumber: number;
    surahNumber: number;
}

export const AyahShareCard: React.FC<AyahShareCardProps> = ({
    visible,
    onDismiss,
    arabicText,
    translation,
    surahName,
    surahNameArabic,
    verseNumber,
    surahNumber,
}) => {
    const theme = useTheme();

    const shareText = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await Share.share({
                message: `${arabicText}\n\n"${translation}"\n\n— ${surahName} (${surahNameArabic}), Verse ${verseNumber}\n\nShared via QuranNotes 📖`,
            });
        } catch (error) {
            console.error('[Share] Error:', error);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={onDismiss}
        >
            <Pressable style={styles.overlay} onPress={onDismiss}>
                <Pressable onPress={(e) => e.stopPropagation()}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                    >
                        {/* The Card */}
                        <LinearGradient
                            colors={theme.dark
                                ? ['#1A1F36', '#0D1117', '#1A1F36']
                                : ['#F8F6FF', '#FFFFFF', '#F0EDFF']
                            }
                            style={styles.card}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            {/* Decorative top border */}
                            <LinearGradient
                                colors={Gradients.primary}
                                style={styles.topBorder}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            />

                            {/* Bismillah ornament */}
                            <Text style={[styles.ornament, { color: theme.colors.primary }]}>
                                ﷽
                            </Text>

                            {/* Arabic Text */}
                            <Text style={[styles.arabicText, {
                                color: theme.dark ? '#E8E4FF' : '#1A1A2E',
                            }]}>
                                {arabicText}
                            </Text>

                            {/* Divider */}
                            <View style={[styles.divider, {
                                backgroundColor: theme.colors.primary,
                            }]}>
                                <View style={[styles.dividerDiamond, {
                                    backgroundColor: theme.colors.primary,
                                }]} />
                            </View>

                            {/* Translation */}
                            <Text style={[styles.translationText, {
                                color: theme.dark ? 'rgba(255,255,255,0.8)' : '#3D3D5C',
                            }]}>
                                "{translation}"
                            </Text>

                            {/* Reference */}
                            <View style={styles.referenceRow}>
                                <Text style={[styles.referenceText, {
                                    color: theme.colors.primary,
                                }]}>
                                    — {surahName} ({surahNameArabic}), Verse {verseNumber}
                                </Text>
                            </View>

                            {/* Watermark */}
                            <Text style={[styles.watermark, {
                                color: theme.dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                            }]}>
                                QuranNotes
                            </Text>
                        </LinearGradient>

                        {/* Action Buttons */}
                        <View style={styles.actions}>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    { backgroundColor: theme.colors.primary },
                                    pressed && { opacity: 0.9 },
                                ]}
                                onPress={shareText}
                            >
                                <Ionicons name="share-outline" size={20} color="#FFF" />
                                <Text style={styles.actionText}>Share</Text>
                            </Pressable>

                            <Pressable
                                style={({ pressed }) => [
                                    styles.actionButton,
                                    { backgroundColor: theme.colors.surfaceVariant },
                                    pressed && { opacity: 0.9 },
                                ]}
                                onPress={onDismiss}
                            >
                                <Ionicons name="close" size={20} color={theme.colors.onSurfaceVariant} />
                                <Text style={[styles.actionText, { color: theme.colors.onSurfaceVariant }]}>
                                    Close
                                </Text>
                            </Pressable>
                        </View>
                    </MotiView>
                </Pressable>
            </Pressable>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: Spacing.lg,
        zIndex: 9999,
        elevation: 10, // Android shadow/z-index
    },
    card: {
        width: SCREEN_WIDTH - 48,
        borderRadius: BorderRadius.xl,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.lg,
        overflow: 'hidden',
        ...Shadows.lg,
    },
    topBorder: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 4,
    },
    ornament: {
        fontSize: 36,
        textAlign: 'center',
        marginBottom: Spacing.sm,
        opacity: 0.6,
    },
    arabicText: {
        fontSize: 26,
        lineHeight: 48,
        textAlign: 'center',
        fontWeight: '400',
        marginBottom: Spacing.md,
    },
    divider: {
        height: 1,
        width: 60,
        alignSelf: 'center',
        marginVertical: Spacing.md,
        opacity: 0.3,
    },
    dividerDiamond: {
        width: 8,
        height: 8,
        borderRadius: 1,
        transform: [{ rotate: '45deg' }],
        alignSelf: 'center',
        marginTop: -4,
        opacity: 0.5,
    },
    translationText: {
        fontSize: 16,
        lineHeight: 26,
        textAlign: 'center',
        fontStyle: 'italic',
        marginBottom: Spacing.lg,
    },
    referenceRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    referenceText: {
        fontSize: 13,
        fontWeight: '600',
    },
    referenceDot: {
        fontSize: 8,
    },
    watermark: {
        fontSize: 10,
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    actions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        paddingVertical: 14,
        borderRadius: BorderRadius.lg,
        ...Shadows.sm,
    },
    actionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFF',
    },
});
