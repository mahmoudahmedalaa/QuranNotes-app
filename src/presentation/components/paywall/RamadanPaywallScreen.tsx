import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    Alert,
    Pressable,
    Dimensions,
    Linking,
} from 'react-native';
import { Text, Button, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { revenueCatService, PurchasesOffering } from '../../../infrastructure/payments/RevenueCatService';
import { usePro } from '../../../infrastructure/auth/ProContext';
import { Spacing, BorderRadius } from '../../theme/DesignSystem';
import { MotiView } from 'moti';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { daysUntilRamadanEnds, ramadanCountdownText } from '../../../utils/ramadanUtils';

const { width } = Dimensions.get('window');

const ORIGINAL_ANNUAL_PRICE = 35.99;
const RAMADAN_PRICE = 17.99;
const MONTHLY_PRICE = 4.99;
const SAVINGS_PERCENT = Math.round((1 - RAMADAN_PRICE / ORIGINAL_ANNUAL_PRICE) * 100);

const FEATURES = [
    { icon: 'infinity', title: 'Unlimited Recordings', description: 'Capture every reflection' },
    { icon: 'note-text', title: 'Unlimited Notes', description: 'Journal your Ramadan journey' },
    { icon: 'folder-multiple', title: 'Unlimited Folders', description: 'Organize by Surah or Juz\'' },
    { icon: 'chart-box', title: 'Pro Insights', description: 'Track your spiritual growth' },
    { icon: 'fire', title: 'Streak Tracking', description: 'Stay consistent this Ramadan' },
    { icon: 'school', title: 'Smart Study Mode', description: 'Memorize with purpose' },
];

interface RamadanPaywallProps {
    /** Called on successful purchase or skip — used by onboarding to call completeOnboarding */
    onPurchaseSuccess?: () => void;
    /** Called when user dismisses — used by onboarding to call completeOnboarding */
    onDismiss?: () => void;
}

export default function RamadanPaywallScreen({ onPurchaseSuccess, onDismiss }: RamadanPaywallProps = {}) {
    const theme = useTheme();
    const router = useRouter();
    const { isPro, checkStatus } = usePro();
    const [offering, setOffering] = useState<PurchasesOffering | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [countdown, setCountdown] = useState(ramadanCountdownText());
    const [isAnnual, setIsAnnual] = useState(true);

    useEffect(() => {
        loadOfferings();
        // Update countdown every hour
        const timer = setInterval(() => {
            setCountdown(ramadanCountdownText());
        }, 3600000);
        return () => clearInterval(timer);
    }, []);

    const loadOfferings = async () => {
        try {
            const current = await revenueCatService.getOfferings();
            setOffering(current);
        } catch (e) {
            console.error('Failed to load offerings:', e);
        } finally {
            setLoading(false);
        }
    };

    const handlePurchase = async () => {
        if (!offering) {
            Alert.alert('Error', 'Could not load products. Please try again.');
            return;
        }

        const packageToBuy = isAnnual ? offering.annual : offering.monthly;
        if (!packageToBuy) {
            Alert.alert('Error', 'Product not available.');
            return;
        }

        setPurchasing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const { success, userCancelled, error } = await revenueCatService.purchasePackage(packageToBuy);
            if (success) {
                checkStatus();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (onPurchaseSuccess) {
                    onPurchaseSuccess();
                } else {
                    Alert.alert(
                        'Ramadan Mubarak! 🌙',
                        'You\'re now a Pro member. May this Ramadan be blessed!',
                        [{ text: 'Jazak Allah Khair', onPress: () => router.back() }]
                    );
                }
            } else if (userCancelled) {
            } else {
                Alert.alert('Purchase Failed', error || 'Could not complete purchase. Please try again.');
            }
        } catch (error) {
            console.error('Purchase failed:', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        setPurchasing(true);
        const success = await revenueCatService.restorePurchases();
        setPurchasing(false);
        if (success) {
            checkStatus();
            Alert.alert('Restored', 'Your purchases have been restored.');
            if (onPurchaseSuccess) onPurchaseSuccess(); else router.back();
        } else {
            Alert.alert('Error', 'Could not restore purchases.');
        }
    };

    if (loading) {
        return (
            <LinearGradient
                colors={['#1a0533', '#2d1b69', '#1a0533']}
                style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#D4AF37" />
            </LinearGradient>
        );
    }

    return (
        <LinearGradient
            colors={['#1a0533', '#2d1b69', '#1a0533']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.3, y: 1 }}>

            {/* Decorative Islamic Pattern Overlay */}
            <View style={styles.patternOverlay}>
                <Text style={styles.patternText}>✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦ ✧ ✦</Text>
            </View>

            <SafeAreaView style={styles.safeArea}>
                {/* Close Button */}
                <Pressable
                    onPress={() => onDismiss ? onDismiss() : router.back()}
                    style={styles.closeButton}
                    hitSlop={16}>
                    <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                </Pressable>

                <ScrollView
                    style={styles.scrollView}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.scrollContent}>

                    {/* Crescent Moon Header */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 12 }}
                        style={styles.moonContainer}>
                        <Text style={styles.moonEmoji}>🌙</Text>
                        <View style={styles.starsRow}>
                            <Text style={styles.starEmoji}>✨</Text>
                            <Text style={[styles.starEmoji, { fontSize: 12, marginTop: -10 }]}>⭐</Text>
                            <Text style={styles.starEmoji}>✨</Text>
                        </View>
                    </MotiView>

                    {/* Title */}
                    <MotiView
                        from={{ opacity: 0, translateY: -15 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 500, delay: 200 }}
                        style={styles.header}>
                        <Text style={styles.ramadanBadge}>RAMADAN SPECIAL</Text>
                        <Text style={styles.title}>Your Ramadan{'\n'}Companion</Text>
                        <Text style={styles.subtitle}>
                            Deepen your connection with the Quran{'\n'}this blessed month
                        </Text>
                    </MotiView>

                    {/* Plan Selector */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: 400 }}
                        style={styles.planSelector}>

                        {/* Annual Plan — the star */}
                        <Pressable
                            onPress={() => setIsAnnual(true)}
                            style={[
                                styles.planCard,
                                isAnnual && styles.planCardSelected,
                            ]}>
                            {isAnnual && (
                                <View style={styles.bestValueBadge}>
                                    <Text style={styles.bestValueText}>BEST VALUE</Text>
                                </View>
                            )}
                            <View style={styles.planHeader}>
                                <View style={[styles.planRadio, isAnnual && styles.planRadioSelected]}>
                                    {isAnnual && <View style={styles.planRadioDot} />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.planName, isAnnual && styles.planNameSelected]}>Annual</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                                        <Text style={[styles.planOriginalPrice, isAnnual && { color: 'rgba(255,255,255,0.4)' }]}>
                                            ${ORIGINAL_ANNUAL_PRICE.toFixed(2)}
                                        </Text>
                                        <Text style={[styles.planPrice, isAnnual && styles.planPriceSelected]}>
                                            ${RAMADAN_PRICE.toFixed(2)}/yr
                                        </Text>
                                    </View>
                                </View>
                                <View style={styles.discountBadge}>
                                    <Text style={styles.discountBadgeText}>{SAVINGS_PERCENT}% OFF</Text>
                                </View>
                            </View>
                            <Text style={[styles.planDetail, isAnnual && { color: 'rgba(212,175,55,0.8)' }]}>
                                Just ${(RAMADAN_PRICE / 12).toFixed(2)}/mo • Ramadan Special
                            </Text>
                        </Pressable>

                        {/* Monthly Plan */}
                        <Pressable
                            onPress={() => setIsAnnual(false)}
                            style={[
                                styles.planCard,
                                !isAnnual && styles.planCardSelected,
                            ]}>
                            <View style={styles.planHeader}>
                                <View style={[styles.planRadio, !isAnnual && styles.planRadioSelected]}>
                                    {!isAnnual && <View style={styles.planRadioDot} />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.planName, !isAnnual && styles.planNameSelected]}>Monthly</Text>
                                    <Text style={[styles.planPrice, !isAnnual && styles.planPriceSelected]}>
                                        ${MONTHLY_PRICE.toFixed(2)}/mo
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    </MotiView>

                    {/* Countdown Timer */}
                    {isAnnual && (
                        <View style={[styles.countdownRow, { alignSelf: 'center', marginBottom: Spacing.sm }]}>
                            <Ionicons name="time-outline" size={14} color="#D4AF37" />
                            <Text style={styles.countdownText}>
                                Offer ends with Ramadan • {countdown}
                            </Text>
                        </View>
                    )}

                    {/* Features */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', delay: 600 }}
                        style={styles.featuresContainer}>
                        {FEATURES.map((feature, index) => (
                            <MotiView
                                key={feature.title}
                                from={{ opacity: 0, translateX: -15 }}
                                animate={{ opacity: 1, translateX: 0 }}
                                transition={{ type: 'timing', delay: 700 + index * 60 }}
                                style={styles.featureRow}>
                                <View style={styles.featureIcon}>
                                    <MaterialCommunityIcons
                                        name={feature.icon as any}
                                        size={18}
                                        color="#D4AF37"
                                    />
                                </View>
                                <View style={styles.featureText}>
                                    <Text style={styles.featureTitle}>{feature.title}</Text>
                                    <Text style={styles.featureDescription}>{feature.description}</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={20} color="#4ADE80" />
                            </MotiView>
                        ))}
                    </MotiView>
                </ScrollView>

                {/* CTA Section */}
                <MotiView
                    from={{ opacity: 0, translateY: 30 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 1000 }}
                    style={styles.ctaContainer}>

                    {/* Main CTA */}
                    <Pressable
                        onPress={handlePurchase}
                        disabled={purchasing}
                        style={({ pressed }) => [
                            styles.ctaButton,
                            pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 },
                        ]}>
                        <LinearGradient
                            colors={['#D4AF37', '#B8960C', '#D4AF37']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.ctaGradient}>
                            {purchasing ? (
                                <ActivityIndicator color="#1a0533" />
                            ) : (
                                <>
                                    <Text style={styles.ctaText}>
                                        {isAnnual ? 'Start Your Ramadan Journey' : 'Subscribe Monthly'}
                                    </Text>
                                    <Text style={styles.ctaSubtext}>
                                        {isAnnual ? '🌙 50% off — Limited time' : `$${MONTHLY_PRICE.toFixed(2)}/month`}
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </Pressable>

                    {/* Maybe Later */}
                    <Pressable onPress={() => onDismiss ? onDismiss() : router.back()} style={styles.secondaryButton}>
                        <Text style={styles.secondaryText}>Maybe Later</Text>
                    </Pressable>

                    {/* Restore */}
                    <Pressable onPress={handleRestore} style={styles.restoreButton}>
                        <Text style={styles.restoreText}>Restore Purchases</Text>
                    </Pressable>

                    {/* Disclosure */}
                    <Text style={styles.disclosureText}>
                        {isAnnual
                            ? `Ramadan offer: $${RAMADAN_PRICE.toFixed(2)} for the first year, then $${ORIGINAL_ANNUAL_PRICE.toFixed(2)}/year. `
                            : `$${MONTHLY_PRICE.toFixed(2)}/month. `
                        }
                        Payment will be charged to your Apple ID account. Subscription automatically renews unless
                        cancelled at least 24 hours before the end of the current period.
                        Manage in Settings → Apple ID → Subscriptions.
                    </Text>

                    {/* Legal Links */}
                    <View style={styles.legalRow}>
                        <Pressable onPress={() => Linking.openURL('https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/privacy.html')}>
                            <Text style={styles.legalLink}>Privacy Policy</Text>
                        </Pressable>
                        <Text style={styles.legalDivider}>|</Text>
                        <Pressable onPress={() => Linking.openURL('https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/terms.html')}>
                            <Text style={styles.legalLink}>Terms of Use</Text>
                        </Pressable>
                    </View>
                </MotiView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    patternOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingTop: 50,
        opacity: 0.08,
    },
    patternText: {
        fontSize: 24,
        color: '#D4AF37',
        letterSpacing: 8,
    },
    safeArea: {
        flex: 1,
    },
    closeButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        zIndex: 10,
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: Spacing.md,
    },
    moonContainer: {
        alignItems: 'center',
        paddingTop: Spacing.xl + 10,
    },
    moonEmoji: {
        fontSize: 56,
    },
    starsRow: {
        flexDirection: 'row',
        gap: 20,
        marginTop: -8,
    },
    starEmoji: {
        fontSize: 16,
    },
    header: {
        alignItems: 'center',
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    ramadanBadge: {
        fontSize: 11,
        fontWeight: '800',
        color: '#D4AF37',
        letterSpacing: 3,
        marginBottom: Spacing.sm,
    },
    title: {
        fontSize: 30,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        textAlign: 'center',
        lineHeight: 36,
    },
    subtitle: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: Spacing.xs,
        textAlign: 'center',
        lineHeight: 20,
    },
    // Plan Selector
    planSelector: {
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
        gap: Spacing.sm,
    },
    planCard: {
        borderRadius: BorderRadius.lg,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.12)',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: Spacing.md,
        position: 'relative' as const,
    },
    planCardSelected: {
        borderColor: '#D4AF37',
        backgroundColor: 'rgba(212,175,55,0.08)',
    },
    bestValueBadge: {
        position: 'absolute' as const,
        top: -10,
        right: 14,
        backgroundColor: '#D4AF37',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 10,
    },
    bestValueText: {
        fontSize: 10,
        fontWeight: '800' as const,
        color: '#1a0533',
        letterSpacing: 0.5,
    },
    planHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: Spacing.sm,
    },
    planRadio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
    },
    planRadioSelected: {
        borderColor: '#D4AF37',
    },
    planRadioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#D4AF37',
    },
    planName: {
        fontSize: 15,
        fontWeight: '600' as const,
        color: 'rgba(255,255,255,0.6)',
    },
    planNameSelected: {
        color: '#FFFFFF',
    },
    planOriginalPrice: {
        fontSize: 14,
        fontWeight: '500' as const,
        color: 'rgba(255,255,255,0.25)',
        textDecorationLine: 'line-through' as const,
    },
    planPrice: {
        fontSize: 18,
        fontWeight: '700' as const,
        color: 'rgba(255,255,255,0.5)',
    },
    planPriceSelected: {
        color: '#D4AF37',
    },
    planDetail: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 4,
        marginLeft: 32,
    },
    discountBadge: {
        backgroundColor: '#D4AF37',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
    },
    discountBadgeText: {
        fontSize: 10,
        fontWeight: '800' as const,
        color: '#1a0533',
        letterSpacing: 0.5,
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: Spacing.md,
        backgroundColor: 'rgba(212,175,55,0.1)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    countdownText: {
        fontSize: 12,
        color: '#D4AF37',
        fontWeight: '600',
    },
    // Features
    featuresContainer: {
        paddingHorizontal: Spacing.lg,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: Spacing.sm,
    },
    featureIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(212,175,55,0.12)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.sm,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    featureDescription: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.55)',
        marginTop: 1,
    },
    // CTA
    ctaContainer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.lg,
    },
    ctaButton: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
    },
    ctaGradient: {
        paddingVertical: 16,
        alignItems: 'center',
        borderRadius: BorderRadius.xl,
    },
    ctaText: {
        fontSize: 17,
        fontWeight: '700',
        color: '#1a0533',
    },
    ctaSubtext: {
        fontSize: 12,
        fontWeight: '500',
        color: 'rgba(26,5,51,0.7)',
        marginTop: 2,
    },
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    secondaryText: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
    },
    restoreButton: {
        alignItems: 'center',
        paddingBottom: Spacing.xs,
    },
    restoreText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    disclosureText: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        lineHeight: 14,
        paddingHorizontal: Spacing.sm,
        marginTop: Spacing.sm,
    },
    legalRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
        paddingBottom: Spacing.xs,
    },
    legalLink: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    legalDivider: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.2)',
    },
});
