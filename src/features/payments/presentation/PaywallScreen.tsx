import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable, Linking } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams, Redirect } from 'expo-router';
import { revenueCatService, PurchasesOffering } from '../infrastructure/RevenueCatService';
import { usePro } from '../../auth/infrastructure/ProContext';
import { useAuth } from '../../auth/infrastructure/AuthContext';
import { Spacing, BorderRadius, BrandTokens } from '../../../core/theme/DesignSystem';
import { MotiView } from 'moti';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { isRamadanSeason } from '../../../core/utils/ramadanUtils';
import { TelemetryService } from '../infrastructure/TelemetryService';
import {
    BillingPeriod,
    getAvailableBillingPeriods,
    getBillingPeriodUnit,
    getDefaultBillingPeriod,
    getSelectedPackage,
    getTrialBadgeText,
    getTrialCtaText,
} from './paywallOfferUtils';


const FEATURES = [
    { icon: 'infinity', title: 'Unlimited Recordings', description: 'Capture every reflection' },
    { icon: 'note-text', title: 'Unlimited Notes', description: 'Journal your Ramadan journey' },
    { icon: 'folder-multiple', title: 'Unlimited Folders', description: 'Organize by Surah or Juz\'' },
    { icon: 'chart-box', title: 'Pro Insights', description: 'Track your spiritual growth' },
    { icon: 'fire', title: 'Streak Tracking', description: 'Stay consistent this Ramadan' },
    { icon: 'book-clock', title: 'Khatma Completion Tracker', description: '30-day Quran completion' },
    { icon: 'heart-pulse', title: 'Mood Tracking & Meditation', description: 'Daily mood-based verse guidance' },
    { icon: 'book-open-page-variant', title: 'Hadith Library', description: 'Browse all topics & hadiths' },
    { icon: 'refresh', title: 'Unlimited Hadith Refresh', description: 'Discover new hadiths anytime' },
    { icon: 'bell-ring', title: 'Daily Hadith Notifications', description: 'Prophetic wisdom every morning' },
    { icon: 'image-multiple', title: 'Premium Share Templates', description: 'Beautiful cards for social sharing' },
    { icon: 'auto-fix', title: 'Noor AI & Quran Explanations', description: 'Source-grounded verse explanations & Q&A' },
];

const PLAN_LABELS: Record<BillingPeriod, string> = {
    monthly: 'Monthly',
    annual: 'Annual',
    lifetime: 'Lifetime',
};

export default function PaywallScreen() {
    const router = useRouter();
    const { reason, hard } = useLocalSearchParams<{ reason?: string; hard?: string }>();
    const { checkStatus } = usePro();
    const { user } = useAuth();
    const [offering, setOffering] = useState<PurchasesOffering | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const operationInFlightRef = useRef(false);
    const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('annual');
    const isHardPaywall = hard === '1';

    useEffect(() => {
        loadOfferings();
    }, []);

    useEffect(() => {
        if (!user) return;

        TelemetryService.trackPaywallView(user.id, {
            hardPaywall: isHardPaywall,
            location: 'modal',
            reason,
        }).catch(() => { });
    }, [user, isHardPaywall, reason]);

    const loadOfferings = async () => {
        try {
            const current = await revenueCatService.getOfferings();
            setOffering(current);
            const defaultPeriod = getDefaultBillingPeriod(current);
            if (defaultPeriod) setSelectedPeriod(defaultPeriod);
        } catch (e) {
            if (__DEV__) console.error('Failed to load offerings:', e);
        } finally {
            setLoading(false);
        }
    };

    // During Ramadan season (2 weeks before → end), redirect to the special Ramadan paywall
    if (isRamadanSeason()) {
        const redirectHref = `/ramadan-paywall?location=ramadan${isHardPaywall ? '&hard=1' : ''}`;
        return <Redirect href={redirectHref as any} />;
    }

    // Get context-specific messaging
    const getMessage = () => {
        switch (reason) {
            case 'recordings':
                return {
                    title: 'Unlock Unlimited Recordings',
                    subtitle: 'Free users are limited to 5 voice recordings. Upgrade to Pro for unlimited reflections.',
                    highlightIndex: 0
                };
            case 'notes':
                return {
                    title: 'Unlock Unlimited Notes',
                    subtitle: 'Free users are limited to 7 notes. Upgrade to Pro for unlimited insights.',
                    highlightIndex: 1
                };
            case 'folders':
                return {
                    title: 'Unlock Unlimited Folders',
                    subtitle: 'Free users are limited to 2 folders. Upgrade to Pro for unlimited organization.',
                    highlightIndex: 2
                };
            case 'insights':
                return {
                    title: 'Unlock Advanced Insights',
                    subtitle: 'Get detailed analytics and track your spiritual journey.',
                    highlightIndex: 4
                };
            case 'khatma':
                return {
                    title: 'Unlock Khatma Tracker',
                    subtitle: 'You\'ve completed your free Khatma preview. Upgrade to Pro to continue tracking your Quran completion journey.',
                    highlightIndex: 3
                };
            case 'hadith-refresh':
                return {
                    title: 'Unlimited Hadith Refresh',
                    subtitle: 'You\'ve used your 3 free refreshes today. Upgrade to Pro for unlimited hadith discovery.',
                    highlightIndex: 8
                };
            case 'hadith-bookmarks':
                return {
                    title: 'Save More Hadiths',
                    subtitle: 'Free users can save up to 3 hadiths. Upgrade to Pro for unlimited favorites.',
                    highlightIndex: 7
                };
            case 'hadith-library':
                return {
                    title: 'Unlock Hadith Library',
                    subtitle: 'Browse all hadith topics and discover the Prophet\'s wisdom. Upgrade to Pro for full access.',
                    highlightIndex: 7
                };
            case 'premium-sharing':
                return {
                    title: 'Unlock Premium Templates',
                    subtitle: 'Share beautiful, professionally designed cards with your community.',
                    highlightIndex: 10
                };
            case 'ai-tafsir':
                return {
                    title: 'Access Noor AI & Quran Explanations',
                    subtitle: 'Upgrade to Pro for source-grounded verse explanations and Q&A.',
                    highlightIndex: 11
                };
            default:
                return {
                    title: isHardPaywall ? 'Continue with QuranNotes Pro' : 'QuranNotes Pro',
                    subtitle: isHardPaywall
                        ? 'This account needs active Pro access or purchase to enter the app. Existing purchases can be restored at any time.'
                        : 'Unlock your full spiritual potential',
                    highlightIndex: null
                };
        }
    };

    const contextMessage = getMessage();

    const handlePurchase = async () => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in before making a purchase.');
            return;
        }

        let currentOffering = offering;
        if (!currentOffering) {
            currentOffering = await revenueCatService.getOfferings();
            setOffering(currentOffering);
        }

        const packageToBuy = getSelectedPackage(currentOffering, selectedPeriod);
        if (!packageToBuy) {
            Alert.alert(
                'Subscription Unavailable',
                'The App Store products are still loading or not available yet. Please close and reopen the app, then try again in a little while.'
            );
            return;
        }

        if (operationInFlightRef.current) return;
        operationInFlightRef.current = true;

        setPurchasing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await revenueCatService.ensureUserIdentity(user.id);
            await TelemetryService.trackSubscriptionEvent(user.id, {
                location: 'modal',
                outcome: 'started',
                hardPaywall: isHardPaywall,
                reason,
            });

            const { success, userCancelled, error } = await revenueCatService.purchasePackage(packageToBuy);

            if (success) {
                const entitlementActive = await checkStatus();
                if (!entitlementActive) {
                    Alert.alert('Purchase Pending', 'Your purchase could not be verified yet. Please try Restore Purchases.');
                    return;
                }
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'modal',
                    outcome: 'success',
                    hardPaywall: isHardPaywall,
                    reason,
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                if (isHardPaywall) {
                    router.replace('/');
                } else {
                    Alert.alert('Success', 'You are now a Pro member!', [
                        { text: 'OK', onPress: () => router.back() }
                    ]);
                }
            } else if (userCancelled) {
                // User cancelled, do nothing (no scary error message)
                if (user) {
                    await TelemetryService.trackSubscriptionEvent(user.id, {
                        location: 'modal',
                        outcome: 'cancelled',
                        hardPaywall: isHardPaywall,
                        reason,
                    });
                }
            } else {
                // Show friendly error message
                if (user) {
                    await TelemetryService.trackSubscriptionEvent(user.id, {
                        location: 'modal',
                        outcome: 'failed',
                        hardPaywall: isHardPaywall,
                        reason,
                        message: error,
                    });
                }
                Alert.alert('Purchase Failed', error || 'Could not complete purchase. Please try again.');
            }
        } catch (error) {
            if (__DEV__) console.error('Purchase failed:', error);
            if (user) {
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'modal',
                    outcome: 'failed',
                    hardPaywall: isHardPaywall,
                    reason,
                });
            }
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            operationInFlightRef.current = false;
            setPurchasing(false);
        }
    };

    const handleRestore = async () => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in before restoring purchases.');
            return;
        }

        if (operationInFlightRef.current) return;
        operationInFlightRef.current = true;

        setPurchasing(true);
        try {
            await revenueCatService.ensureUserIdentity(user.id);
            const success = await revenueCatService.restorePurchases();
            if (success) {
                const entitlementActive = await checkStatus();
                if (!entitlementActive) {
                    Alert.alert('Restore Unavailable', 'No active QuranNotes Pro purchase was found for this account.');
                    return;
                }
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'modal',
                    outcome: 'restored',
                    hardPaywall: isHardPaywall,
                    reason,
                });
                if (isHardPaywall) {
                    Alert.alert('Restored', 'Your purchases have been restored.');
                    router.replace('/');
                } else {
                    Alert.alert('Restored', 'Your purchases have been restored.');
                    router.back();
                }
            } else {
                Alert.alert('Error', 'Could not restore purchases.');
            }
        } catch {
            if (user) {
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'modal',
                    outcome: 'failed',
                    hardPaywall: isHardPaywall,
                    reason: reason || 'restore',
                });
            }
            Alert.alert('Error', 'Could not restore purchases.');
        } finally {
            operationInFlightRef.current = false;
            setPurchasing(false);
        }
    };

    const availablePeriods = getAvailableBillingPeriods(offering);
    const selectedPackage = getSelectedPackage(offering, selectedPeriod);
    const trialBadgeText = getTrialBadgeText(selectedPackage, selectedPeriod);
    const ctaText = getTrialCtaText(selectedPackage, 'Unlock Full Access', selectedPeriod);
    const billingUnit = getBillingPeriodUnit(selectedPeriod);

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <LinearGradient
            colors={['#1A1340', '#312E81', '#1A1340']}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={styles.header}>
                    <Text style={styles.title}>{contextMessage.title}</Text>
                    <Text style={styles.subtitle}>{contextMessage.subtitle}</Text>
                </MotiView>

                {/* Features List */}
                <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', delay: 200 }}
                        style={styles.featuresContainer}>
                        {FEATURES.map((feature, index) => (
                            <MotiView
                                key={feature.title}
                                from={{ opacity: 0, translateX: -20 }}
                                animate={{ opacity: 1, translateX: 0 }}
                                transition={{ type: 'timing', delay: 300 + index * 80 }}
                                style={[
                                    styles.featureRow,
                                    contextMessage.highlightIndex === index && styles.featureHighlighted,
                                ]}>
                                <View style={styles.featureIcon}>
                                    <MaterialCommunityIcons
                                        name={feature.icon as React.ComponentProps<typeof MaterialCommunityIcons>['name']}
                                        size={20}
                                        color="rgba(255,255,255,0.9)"
                                    />
                                </View>
                                <View style={styles.featureText}>
                                    <Text style={styles.featureTitle}>{feature.title}</Text>
                                    <Text style={styles.featureDescription}>{feature.description}</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={22} color="#4ADE80" />
                            </MotiView>
                        ))}
                    </MotiView>

                    {/* Pricing Selector */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', delay: 800 }}
                        style={styles.pricingContainer}>
                        <View style={styles.planSelector}>
                            {availablePeriods.map(period => {
                                const planPackage = getSelectedPackage(offering, period);
                                const selected = period === selectedPeriod;
                                return (
                                    <Pressable
                                        key={period}
                                        accessibilityRole="button"
                                        accessibilityLabel={`Select ${PLAN_LABELS[period]} plan`}
                                        accessibilityState={{ selected, disabled: purchasing }}
                                        disabled={purchasing}
                                        onPress={() => setSelectedPeriod(period)}
                                        style={[styles.planOption, selected && styles.planOptionSelected]}>
                                        <Text style={[styles.planName, selected && styles.planNameSelected]}>
                                            {PLAN_LABELS[period]}
                                        </Text>
                                        <Text style={[styles.planPrice, selected && styles.planNameSelected]}>
                                            {planPackage?.product.priceString}
                                        </Text>
                                        <Text style={styles.planDetail}>
                                            {period === 'lifetime' ? 'One-time purchase' : `${PLAN_LABELS[period]} subscription`}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>

                        <Text style={styles.selectedPlanSummary}>
                            {selectedPeriod === 'lifetime'
                                ? 'Lifetime · One-time purchase'
                                : `${PLAN_LABELS[selectedPeriod]} subscription${billingUnit ? ` · ${billingUnit}` : ''}`}
                        </Text>
                        {trialBadgeText && (
                            <Text style={styles.trialText}>{trialBadgeText}</Text>
                        )}
                        <Text style={styles.fairUseText}>
                            Includes up to 50 successful AI answers per UTC day. Your allowance resets daily.
                        </Text>
                    </MotiView>
                </ScrollView>

                {/* CTA Buttons */}
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 1000 }}
                    style={styles.ctaContainer}>
                    <Button
                        mode="contained"
                        onPress={() => handlePurchase()}
                        accessibilityLabel="Purchase selected plan"
                        style={styles.ctaButton}
                        labelStyle={styles.ctaLabel}
                        buttonColor="#FFFFFF"
                        textColor={BrandTokens.light.accentPrimary}
                        loading={purchasing}
                        disabled={purchasing || !selectedPackage}>
                        {ctaText}
                    </Button>
                    {!isHardPaywall && (
                        <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
                            <Text style={styles.secondaryText}>Maybe Later</Text>
                        </Pressable>
                    )}

                    {/* Restore Purchases */}
                    <Pressable
                        onPress={handleRestore}
                        accessibilityRole="button"
                        accessibilityLabel="Restore purchases"
                        accessibilityState={{ disabled: purchasing }}
                        disabled={purchasing}
                        style={styles.restoreButton}>
                        <Text style={styles.restoreText}>Restore Purchases</Text>
                    </Pressable>

                    {/* Subscription Disclosure */}
                    {selectedPackage && (
                        <Text style={styles.disclosureText}>
                            {trialBadgeText ? `${trialBadgeText}. ` : ''}
                            {selectedPeriod === 'lifetime'
                                ? `Lifetime: ${selectedPackage.product.priceString}. One-time purchase. Payment will be charged to your Apple ID account.`
                                : `${PLAN_LABELS[selectedPeriod]} subscription: ${selectedPackage.product.priceString}${billingUnit}. Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period. Manage in Settings → Apple ID → Subscriptions.`}
                        </Text>
                    )}

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
    safeArea: {
        flex: 1,
    },
    scrollView: {
        flex: 1,
    },
    header: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -1,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        marginTop: Spacing.xs,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    featuresContainer: {
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
    },
    featureRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
    },
    featureHighlighted: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    featureIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    featureText: {
        flex: 1,
    },
    featureTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    featureDescription: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 1,
    },
    pricingContainer: {
        alignItems: 'center',
        paddingVertical: Spacing.xl,
        paddingHorizontal: Spacing.lg,
    },
    planSelector: {
        width: '100%',
        gap: Spacing.sm,
    },
    planOption: {
        minHeight: 64,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    planOptionSelected: {
        borderColor: '#FFFFFF',
        backgroundColor: 'rgba(255,255,255,0.18)',
    },
    planName: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 15,
        fontWeight: '600',
    },
    planNameSelected: {
        color: '#FFFFFF',
    },
    planPrice: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 18,
        fontWeight: '800',
        marginTop: 2,
    },
    planDetail: {
        color: 'rgba(255,255,255,0.65)',
        fontSize: 12,
        marginTop: 2,
    },
    selectedPlanSummary: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
        marginTop: Spacing.md,
    },
    fairUseText: {
        color: 'rgba(255,255,255,0.75)',
        fontSize: 12,
        lineHeight: 17,
        marginTop: Spacing.md,
        textAlign: 'center',
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    toggleLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '500',
    },
    annualLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    savingsBadge: {
        backgroundColor: '#4ADE80',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    savingsText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#065F46',
    },
    priceDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: Spacing.md,
    },
    price: {
        fontSize: 48,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    priceUnit: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.8)',
        marginLeft: 4,
    },
    priceNote: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.7)',
        marginTop: Spacing.xs,
    },
    trialText: {
        fontSize: 14,
        color: '#4ADE80',
        marginTop: Spacing.xs,
        fontWeight: '700',
        textTransform: 'capitalize',
    },
    ctaContainer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xl,
    },
    ctaButton: {
        borderRadius: BorderRadius.xl,
        paddingVertical: Spacing.xs,
    },
    ctaLabel: {
        fontSize: 18,
        fontWeight: '700',
        paddingVertical: Spacing.xs,
    },
    secondaryButton: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    secondaryText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
    restoreButton: {
        alignItems: 'center',
        paddingBottom: Spacing.sm,
    },
    restoreText: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    disclosureText: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        lineHeight: 16,
        paddingHorizontal: Spacing.sm,
        marginTop: Spacing.xs,
    },
    legalRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: Spacing.sm,
        marginTop: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    legalLink: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
    legalDivider: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.3)',
    },
});
