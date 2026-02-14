/**
 * KhatmaCelebrationModal — Premium full-screen celebration when Khatma is complete
 * Gradient background, staggered animations, share-as-image, English + Arabic text.
 */
import React, { useRef, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Pressable,
    Dimensions,
    Modal,
    Platform,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { Spacing, BorderRadius, Shadows } from '../../theme/DesignSystem';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Color palette — warmer, softer celebration tones (aligned with app gold accents) ──
const COLORS = {
    // Gradient background — softer celebratory violet-indigo
    gradientStart: '#4A3691',     // Warm medium purple
    gradientMid: '#352770',       // Muted violet
    gradientEnd: '#261D55',       // Soft deep indigo

    // Gold accents (matches app secondary #D4A853)
    gold: '#F5C542',
    goldLight: '#D4A853',
    goldGlow: 'rgba(245, 197, 66, 0.30)',

    // Primary accent — warm gold instead of cold purple
    primary: '#D4A853',
    primaryDeep: '#C49A48',

    // Text (light on softer dark background)
    headline: '#FFFFFF',
    body: '#F0E8D8',              // Warm cream body
    caption: '#D0C4A8',           // Warm muted caption

    // Share button gradient (warm gold)
    shareStart: '#F5C542',
    shareEnd: '#D4A853',

    // Badge
    badgeBg: 'rgba(245, 197, 66, 0.15)',
    badgeText: '#F5C542',

    // Surface overlay
    surfaceOverlay: 'rgba(255, 255, 255, 0.10)',
    divider: 'rgba(245, 197, 66, 0.3)',
};

// ─── Sparkle positions (decorative) ─────────────────────────────────────────
const SPARKLES = [
    { top: '8%', left: '15%', size: 6, delay: 0 },
    { top: '12%', right: '20%', size: 8, delay: 200 },
    { top: '20%', left: '10%', size: 5, delay: 400 },
    { top: '18%', right: '12%', size: 7, delay: 100 },
    { top: '5%', left: '40%', size: 4, delay: 300 },
    { top: '25%', right: '30%', size: 5, delay: 500 },
    { top: '15%', left: '70%', size: 6, delay: 150 },
    { top: '30%', left: '20%', size: 4, delay: 350 },
];

interface KhatmaCelebrationModalProps {
    visible: boolean;
    onDismiss: () => void;
    onStartNextRound?: () => void;
    currentRound: number;
    daysAhead: number;
    ramadanDay: number;
    totalPagesRead?: number;
    completedJuzCount?: number;
}

export const KhatmaCelebrationModal: React.FC<KhatmaCelebrationModalProps> = ({
    visible,
    onDismiss,
    onStartNextRound,
    currentRound,
    daysAhead,
    ramadanDay,
    totalPagesRead = 604,
    completedJuzCount = 30,
}) => {
    const viewShotRef = useRef<ViewShot>(null);
    const hasRemainingDays = ramadanDay < 30;

    const getEnglishHeadline = () => {
        if (currentRound > 1) return `${currentRound} Khatmas Complete!`;
        return 'Khatma Complete!';
    };

    const getSubtitle = () => {
        if (currentRound > 1)
            return `Masha'Allah! You've completed ${currentRound} full readings of the Quran this Ramadan!`;
        if (daysAhead > 0)
            return `You finished ${daysAhead} day${daysAhead === 1 ? '' : 's'} ahead of schedule!`;
        return 'You completed the entire Quran during Ramadan!';
    };

    const getArabicText = () => {
        if (currentRound > 1) return 'الله أكبر';
        return 'تمت الختمة';
    };

    const handleShare = useCallback(async () => {
        try {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            if (!viewShotRef.current?.capture) {
                Alert.alert('Error', 'Unable to capture image');
                return;
            }

            const uri = await viewShotRef.current.capture();

            const isAvailable = await Sharing.isAvailableAsync();
            if (!isAvailable) {
                Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
                return;
            }

            await Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                dialogTitle: 'Share your Khatma achievement',
                UTI: 'public.png',
            });
        } catch (e) {
            console.warn('Share failed:', e);
        }
    }, []);

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onDismiss}
            statusBarTranslucent
        >
            <View style={styles.backdrop}>
                {/* Full-screen gradient background */}
                <LinearGradient
                    colors={[COLORS.gradientStart, COLORS.gradientMid, COLORS.gradientEnd]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                />

                {/* ✨ Sparkles */}
                {SPARKLES.map((sparkle, i) => (
                    <MotiView
                        key={i}
                        from={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: [0, 1, 0.5, 1, 0.3], scale: [0, 1, 0.8, 1.1, 0.9] }}
                        transition={{
                            type: 'timing',
                            duration: 2000,
                            delay: sparkle.delay + 500,
                            loop: true,
                        }}
                        style={[
                            styles.sparkle,
                            {
                                top: sparkle.top as any,
                                left: sparkle.left as any,
                                right: sparkle.right as any,
                                width: sparkle.size,
                                height: sparkle.size,
                                borderRadius: sparkle.size / 2,
                            },
                        ]}
                    />
                ))}

                {/* ── Shareable Card Content (captured by ViewShot) ── */}
                <ViewShot
                    ref={viewShotRef}
                    options={{ format: 'png', quality: 1.0 }}
                    style={styles.viewShotContainer}
                >
                    <LinearGradient
                        colors={[COLORS.gradientStart, COLORS.gradientMid, COLORS.gradientEnd]}
                        style={styles.shareableCard}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {/* Sparkles in shareable card */}
                        {SPARKLES.slice(0, 5).map((sparkle, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.sparkleStatic,
                                    {
                                        top: sparkle.top as any,
                                        left: sparkle.left as any,
                                        right: sparkle.right as any,
                                        width: sparkle.size,
                                        height: sparkle.size,
                                        borderRadius: sparkle.size / 2,
                                    },
                                ]}
                            />
                        ))}

                        {/* 🌙 Crescent Moon */}
                        <View style={styles.moonContainer}>
                            <View style={styles.moonGlow} />
                            <MaterialCommunityIcons
                                name="moon-waning-crescent"
                                size={64}
                                color={COLORS.gold}
                            />
                        </View>

                        {/* Arabic Title */}
                        <Text style={styles.arabicTitle}>{getArabicText()}</Text>

                        {/* English Headline */}
                        <Text style={styles.englishHeadline}>{getEnglishHeadline()}</Text>

                        {/* Subtitle */}
                        <Text style={styles.subtitle}>{getSubtitle()}</Text>

                        {/* ── Stats Row ── */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{totalPagesRead}</Text>
                                <Text style={styles.statLabel}>Pages</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{completedJuzCount}</Text>
                                <Text style={styles.statLabel}>Juz</Text>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Text style={styles.statNumber}>{ramadanDay}</Text>
                                <Text style={styles.statLabel}>Days</Text>
                            </View>
                        </View>

                        {/* Round Badge */}
                        <View style={styles.roundBadge}>
                            <MaterialCommunityIcons name="check-decagram" size={18} color={COLORS.badgeText} />
                            <Text style={styles.roundBadgeText}>
                                {currentRound === 1 ? '1st Khatma' : `${currentRound} Khatmas`}
                            </Text>
                        </View>

                        {/* App branding for share */}
                        <View style={styles.brandingRow}>
                            <MaterialCommunityIcons name="bookshelf" size={14} color={COLORS.caption} />
                            <Text style={styles.branding}>QuranNotes App · Ramadan {new Date().getFullYear()}</Text>
                        </View>
                    </LinearGradient>
                </ViewShot>

                {/* ── Animated content overlay (buttons, not captured in share) ── */}
                <View style={styles.buttonsContainer}>
                    {/* Share Button */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 400, delay: 800 }}
                    >
                        <Pressable
                            onPress={handleShare}
                            style={({ pressed }) => [
                                pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
                            ]}
                        >
                            <LinearGradient
                                colors={[COLORS.shareStart, COLORS.shareEnd]}
                                style={styles.shareButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                            >
                                <MaterialCommunityIcons name="share-variant" size={20} color="#FFF" />
                                <Text style={styles.shareButtonText}>Share Your Achievement</Text>
                            </LinearGradient>
                        </Pressable>
                    </MotiView>

                    {/* Start Next Round */}
                    {hasRemainingDays && onStartNextRound && (
                        <MotiView
                            from={{ opacity: 0, translateY: 20 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 400, delay: 900 }}
                        >
                            <Pressable
                                onPress={() => {
                                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                                    onStartNextRound();
                                }}
                                style={({ pressed }) => [
                                    styles.nextRoundButton,
                                    pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
                                ]}
                            >
                                <MaterialCommunityIcons name="restart" size={18} color={COLORS.primary} />
                                <Text style={styles.nextRoundButtonText}>
                                    Start Round {currentRound + 1}
                                </Text>
                            </Pressable>
                        </MotiView>
                    )}

                    {/* Close */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', duration: 400, delay: 1000 }}
                    >
                        <Pressable
                            onPress={onDismiss}
                            style={({ pressed }) => [
                                styles.closeButton,
                                pressed && { opacity: 0.6 },
                            ]}
                        >
                            <Text style={styles.closeButtonText}>Close</Text>
                        </Pressable>
                    </MotiView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ─── Sparkles ────────────────────────────────────────────────────────
    sparkle: {
        position: 'absolute',
        backgroundColor: COLORS.gold,
        zIndex: 1,
    },
    sparkleStatic: {
        position: 'absolute',
        backgroundColor: COLORS.gold,
        opacity: 0.5,
        zIndex: 1,
    },

    // ─── ViewShot container ──────────────────────────────────────────────
    viewShotContainer: {
        width: SCREEN_WIDTH - 40,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
    },
    shareableCard: {
        paddingVertical: 40,
        paddingHorizontal: 28,
        alignItems: 'center',
        borderRadius: 24,
        overflow: 'hidden',
    },

    // ─── Moon ────────────────────────────────────────────────────────────
    moonContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    moonGlow: {
        position: 'absolute',
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.goldGlow,
    },

    // ─── Text ────────────────────────────────────────────────────────────
    arabicTitle: {
        fontSize: 42,
        fontWeight: '800',
        color: COLORS.headline,
        textAlign: 'center',
        lineHeight: 60,
        marginBottom: 4,
    },
    englishHeadline: {
        fontSize: 28,
        fontWeight: '800',
        color: COLORS.primary,
        textAlign: 'center',
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        color: COLORS.body,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
        paddingHorizontal: 10,
    },

    // ─── Stats Row ───────────────────────────────────────────────────────
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceOverlay,
        borderRadius: 16,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginBottom: 20,
        gap: 0,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.headline,
    },
    statLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.caption,
        marginTop: 2,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: COLORS.divider,
    },

    // ─── Round Badge ─────────────────────────────────────────────────────
    roundBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.badgeBg,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 16,
    },
    roundBadgeText: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.badgeText,
    },

    // ─── Branding ────────────────────────────────────────────────────────
    branding: {
        fontSize: 11,
        fontWeight: '500',
        color: COLORS.caption,
        letterSpacing: 0.5,
    },
    brandingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
    },

    // ─── Buttons ─────────────────────────────────────────────────────────
    buttonsContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 50 : 30,
        width: SCREEN_WIDTH - 40,
        gap: 10,
    },
    shareButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 30,
        gap: 10,
        elevation: 6,
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    shareButtonText: {
        color: '#1A1A2E',
        fontWeight: '800',
        fontSize: 17,
        letterSpacing: 0.3,
    },
    nextRoundButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 30,
        gap: 8,
        backgroundColor: 'rgba(212, 168, 83, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(212, 168, 83, 0.3)',
    },
    nextRoundButtonText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 15,
    },
    closeButton: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    closeButtonText: {
        color: COLORS.caption,
        fontWeight: '600',
        fontSize: 14,
    },
});
