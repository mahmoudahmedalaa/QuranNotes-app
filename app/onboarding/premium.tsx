import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOnboarding } from '../../src/features/onboarding/infrastructure/OnboardingContext';
import { useAuth } from '../../src/features/auth/infrastructure/AuthContext';
import {
    Spacing,
    BorderRadius,
    BrandTokens,
    Gradients,
} from '../../src/core/theme/DesignSystem';
import * as Haptics from 'expo-haptics';
import { revenueCatService, PurchasesOffering } from '../../src/features/payments/infrastructure/RevenueCatService';
import { usePro } from '../../src/features/auth/infrastructure/ProContext';
import { isRamadanSeason } from '../../src/core/utils/ramadanUtils';
import RamadanPaywallScreen from '../../src/features/payments/presentation/RamadanPaywallScreen';
import { useSubscriptionAccess } from '../../src/features/payments/infrastructure/useSubscriptionAccess';
import { TelemetryService } from '../../src/features/payments/infrastructure/TelemetryService';
import {
    BillingPeriod,
    getAvailableBillingPeriods,
    getDefaultBillingPeriod,
    getSelectedPackage,
    getTrialBadgeText,
    getTrialCtaText,
} from '../../src/features/payments/presentation/paywallOfferUtils';



const FEATURES = [
    { icon: 'infinity', title: 'Unlimited Recordings', description: 'No 5-recording limit' },
    { icon: 'book-open-page-variant', title: 'Khatma Tracker', description: 'Full Quran completion tracking' },
    { icon: 'meditation', title: 'Unlimited Reflections', description: 'Daily mood-based verse guidance' },
    { icon: 'chart-box', title: 'Pro Insights', description: 'Reflection heatmap & analytics' },
    { icon: 'fire', title: 'Streak Tracking', description: 'Daily consistency gamification' },
    { icon: 'cloud-sync', title: 'Cloud Sync', description: 'Backup across all devices' },
    { icon: 'file-export', title: 'Data Export', description: 'PDF & JSON downloads' },
];

const PLAN_LABELS: Record<BillingPeriod, string> = {
    monthly: 'Monthly',
    annual: 'Annual',
    lifetime: 'Lifetime',
};

export default function OnboardingPremium() {
    useTheme();
    const router = useRouter();
    const { highlight, hard } = useLocalSearchParams<{ highlight?: string; hard?: string }>();
    const { completeOnboarding } = useOnboarding();
    const { checkStatus } = usePro();
    const { user } = useAuth();
    const { requiresSubscription } = useSubscriptionAccess();
    const [selectedPeriod, setSelectedPeriod] = useState<BillingPeriod>('annual');
    const [offering, setOffering] = useState<PurchasesOffering | null>(null);
    const [purchasing, setPurchasing] = useState(false);

    const highlightIndex = highlight ? parseInt(highlight as string) : null;
    const isHardPaywall = hard === '1' || requiresSubscription;
    let showRamadan = false;

    try {
        showRamadan = isRamadanSeason();
    } catch {
        // Date computation failure — fall back to standard paywall
    }

    // ── Ramadan season? Show the Ramadan paywall instead ──
    const handleOnboardingComplete = useCallback(async () => {
        try {
            await completeOnboarding();
        } catch (err) {
            if (__DEV__) console.warn('[Premium] completeOnboarding failed:', err);
        }
        try {
            // Dismiss entire onboarding stack first to force clean re-evaluation at index.tsx
            router.dismissAll();
            router.replace('/');
        } catch (err) {
            if (__DEV__) console.warn('[Premium] navigation failed:', err);
            // Fallback: try a simple replace
            try { router.replace('/'); } catch { /* last resort */ }
        }
    }, [completeOnboarding, router]);

    useEffect(() => {
        const loadOfferings = async () => {
            try {
                const current = await revenueCatService.getOfferings();
                setOffering(current);
                const defaultPeriod = getDefaultBillingPeriod(current);
                if (defaultPeriod) setSelectedPeriod(defaultPeriod);
            } catch {
                // Offerings may fail on simulator — still allow free start
            }
        };
        loadOfferings();
    }, []);

    useEffect(() => {
        if (!user || showRamadan) return;

        TelemetryService.trackPaywallView(user.id, {
            hardPaywall: isHardPaywall,
            location: 'onboarding',
            reason: 'onboarding-premium',
        }).catch(() => { });
    }, [user, isHardPaywall, showRamadan]);

    if (showRamadan) {
        return (
            <RamadanPaywallScreen
                onPurchaseSuccess={handleOnboardingComplete}
                onDismiss={isHardPaywall ? undefined : handleOnboardingComplete}
                allowDismiss={!isHardPaywall}
                location="onboarding"
            />
        );
    }

    const handleSubscribe = async () => {
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

        setPurchasing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await revenueCatService.ensureUserIdentity(user.id);
            await TelemetryService.trackSubscriptionEvent(user.id, {
                location: 'onboarding',
                outcome: 'started',
                hardPaywall: isHardPaywall,
                reason: 'onboarding-premium',
            });

            const { success, userCancelled, error: purchaseError } = await revenueCatService.purchasePackage(packageToBuy);
            if (success) {
                const entitlementActive = await checkStatus();
                if (!entitlementActive) {
                    Alert.alert('Purchase Pending', 'Your purchase could not be verified yet. Please try Restore Purchases.');
                    return;
                }
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'onboarding',
                    outcome: 'success',
                    hardPaywall: isHardPaywall,
                    reason: 'onboarding-premium',
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                try {
                    await completeOnboarding();
                } catch (err) {
                    if (__DEV__) console.warn('[Premium] completeOnboarding failed:', err);
                }
                router.dismissAll();
                router.replace('/');
            } else if (!userCancelled) {
                if (user) {
                    await TelemetryService.trackSubscriptionEvent(user.id, {
                        location: 'onboarding',
                        outcome: 'failed',
                        hardPaywall: isHardPaywall,
                        reason: 'onboarding-premium',
                        message: purchaseError,
                    });
                }
                Alert.alert('Purchase Failed', purchaseError || 'Could not complete purchase. Please try again.');
            } else if (user) {
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'onboarding',
                    outcome: 'cancelled',
                    hardPaywall: isHardPaywall,
                    reason: 'onboarding-premium',
                });
            }
        } catch {
            if (user) {
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'onboarding',
                    outcome: 'failed',
                    hardPaywall: isHardPaywall,
                    reason: 'onboarding-premium',
                });
            }
            Alert.alert('Error', 'Something went wrong. Please try again.');
        } finally {
            setPurchasing(false);
        }
    };

    const handleStartFree = async () => {
        if (isHardPaywall) return;

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await completeOnboarding();
        } catch (err) {
            if (__DEV__) console.warn('[Premium] completeOnboarding failed:', err);
        }
        router.dismissAll();
        router.replace('/');
    };

    const handleRestore = async () => {
        if (!user) {
            Alert.alert('Sign In Required', 'Please sign in before restoring purchases.');
            return;
        }

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
                    location: 'onboarding',
                    outcome: 'restored',
                    hardPaywall: isHardPaywall,
                    reason: 'onboarding-premium',
                });
                Alert.alert('Restored', 'Your purchases have been restored.');
                await handleOnboardingComplete();
            } else {
                Alert.alert('Error', 'Could not restore purchases.');
            }
        } catch {
            if (user) {
                await TelemetryService.trackSubscriptionEvent(user.id, {
                    location: 'onboarding',
                    outcome: 'failed',
                    hardPaywall: isHardPaywall,
                    reason: 'onboarding-restore',
                });
            }
            Alert.alert('Error', 'Could not restore purchases.');
        } finally {
            setPurchasing(false);
        }
    };

    const availablePeriods = getAvailableBillingPeriods(offering);
    const selectedPackage = getSelectedPackage(offering, selectedPeriod);
    const trialBadgeText = getTrialBadgeText(selectedPackage, selectedPeriod);
    const ctaText = getTrialCtaText(selectedPackage, 'Unlock Full Access', selectedPeriod);

    return (
        <LinearGradient colors={Gradients.primary} style={{ flex: 1 }}>
            <SafeAreaView style={styles.safeArea}>
                {/* Header */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={styles.header}>
                    <Text style={styles.title}>QuranNotes Pro</Text>
                    <Text style={styles.subtitle}>
                        {isHardPaywall
                            ? 'New accounts need an active subscription to continue. Existing users keep access.'
                            : 'Unlock your full spiritual potential'}
                    </Text>
                    {trialBadgeText && (
                        <Text style={styles.trialText}>{trialBadgeText}</Text>
                    )}
                </MotiView>

                {/* Features List */}
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
                                highlightIndex === index && styles.featureHighlighted,
                            ]}>
                            <View style={styles.featureIcon}>
                                <MaterialCommunityIcons
                                    name={feature.icon as any}
                                    size={20}
                                    color="rgba(255,255,255,0.9)"
                                />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDescription}>{feature.description}</Text>
                            </View>
                            <Ionicons name="checkmark-circle" size={22} color={BrandTokens.light.accentPrimary} />
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
                                    accessibilityState={{ selected }}
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
                    <Text style={styles.fairUseText}>
                        Includes up to 50 successful AI answers per UTC day. Your allowance resets daily.
                    </Text>
                </MotiView>

                {/* CTA Buttons */}
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 1000 }}
                    style={styles.ctaContainer}>
                    <Button
                        mode="contained"
                        onPress={handleSubscribe}
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
                        <Pressable onPress={handleStartFree} style={styles.secondaryButton}>
                            <Text style={styles.secondaryText}>Start Free</Text>
                        </Pressable>
                    )}
                    <Pressable onPress={handleRestore} style={styles.secondaryButton}>
                        <Text style={styles.secondaryText}>Restore Purchases</Text>
                    </Pressable>
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
    header: {
        alignItems: 'center',
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
    },
    title: {
        fontSize: 32,
        fontWeight: '800',
        color: '#1E1B4B',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: '#4C3D7A',
        marginTop: Spacing.xs,
    },
    trialText: {
        fontSize: 14,
        color: BrandTokens.light.accentPrimary,
        marginTop: Spacing.xs,
        fontWeight: '700',
        textTransform: 'capitalize',
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
        backgroundColor: 'rgba(139, 92, 246, 0.15)',
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
        color: '#1E1B4B',
    },
    featureDescription: {
        fontSize: 12,
        color: '#6B5B95',
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
        borderColor: 'rgba(76,61,122,0.25)',
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        backgroundColor: 'rgba(255,255,255,0.45)',
    },
    planOptionSelected: {
        borderColor: BrandTokens.light.accentPrimary,
        backgroundColor: 'rgba(139,92,246,0.12)',
    },
    planName: {
        color: '#4C3D7A',
        fontSize: 15,
        fontWeight: '600',
    },
    planNameSelected: {
        color: '#1E1B4B',
    },
    planPrice: {
        color: '#4C3D7A',
        fontSize: 18,
        fontWeight: '800',
        marginTop: 2,
    },
    planDetail: {
        color: '#6B5B95',
        fontSize: 12,
        marginTop: 2,
    },
    fairUseText: {
        color: '#4C3D7A',
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
        color: '#4C3D7A',
        fontWeight: '500',
    },
    annualLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    savingsBadge: {
        backgroundColor: BrandTokens.light.accentPrimary,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    savingsText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    priceDisplay: {
        flexDirection: 'row',
        alignItems: 'baseline',
        marginTop: Spacing.md,
    },
    price: {
        fontSize: 48,
        fontWeight: '800',
        color: '#1E1B4B',
    },
    priceUnit: {
        fontSize: 18,
        color: '#6B5B95',
        marginLeft: 4,
    },
    priceNote: {
        fontSize: 14,
        color: '#6B5B95',
        marginTop: Spacing.xs,
    },
    ctaContainer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xl,
        marginTop: 'auto',
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
        color: '#6B5B95',
        fontWeight: '500',
    },
});
