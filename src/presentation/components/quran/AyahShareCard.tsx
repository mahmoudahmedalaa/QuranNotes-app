/**
 * AyahShareCard — Premium shareable ayah card
 *
 * Single tap to share as a beautiful image.
 * Falls back to text sharing silently if image capture fails.
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, Share, Modal, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { useTheme } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { Spacing, BorderRadius, Shadows, Gradients } from '../../theme/DesignSystem';
import * as Haptics from 'expo-haptics';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

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
    const cardRef = useRef<any>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    const handleShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsCapturing(true);

        try {
            // Capture the card as a high-quality PNG
            const uri = await captureRef(cardRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile',
            });

            // Check if native sharing is available
            const isAvailable = await Sharing.isAvailableAsync();
            if (isAvailable) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Share this Ayah',
                    UTI: 'public.png',
                });
            } else {
                // Silent fallback to text sharing
                await shareAsText();
            }
        } catch (error) {
            console.warn('[AyahShareCard] Image capture failed, falling back to text:', error);
            await shareAsText();
        } finally {
            setIsCapturing(false);
        }
    };

    const shareAsText = async () => {
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
                        {/* Close button — top right corner */}
                        <Pressable
                            style={styles.closeBtn}
                            onPress={onDismiss}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        >
                            <Ionicons
                                name="close-circle"
                                size={30}
                                color="rgba(255,255,255,0.7)"
                            />
                        </Pressable>

                        {/* The Card — captured as image */}
                        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
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
                        </ViewShot>

                        {/* Single Share Button */}
                        <Pressable
                            style={({ pressed }) => [
                                styles.shareButton,
                                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
                                isCapturing && { opacity: 0.6 },
                            ]}
                            onPress={handleShare}
                            disabled={isCapturing}
                        >
                            <LinearGradient
                                colors={Gradients.primary}
                                style={styles.shareButtonGradient}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                {isCapturing ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Ionicons name="share-outline" size={22} color="#FFF" />
                                )}
                                <Text style={styles.shareButtonText}>
                                    {isCapturing ? 'Preparing...' : 'Share'}
                                </Text>
                            </LinearGradient>
                        </Pressable>
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
    },
    closeBtn: {
        position: 'absolute',
        top: -14,
        right: -10,
        zIndex: 10,
        padding: 4,
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
    watermark: {
        fontSize: 10,
        textAlign: 'center',
        fontWeight: '500',
        letterSpacing: 2,
        textTransform: 'uppercase',
    },
    shareButton: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        ...Shadows.md,
    },
    shareButtonGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.sm,
        paddingVertical: 16,
        borderRadius: BorderRadius.xl,
    },
    shareButtonText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#FFF',
        letterSpacing: 0.5,
    },
});
