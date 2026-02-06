import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform, Pressable, Switch, Dimensions } from 'react-native';
import { Text, Button, useTheme, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { revenueCatService, PurchasesOffering, PurchasesPackage } from '../../../infrastructure/payments/RevenueCatService';
import { usePro } from '../../../infrastructure/auth/ProContext';
import { Spacing, BorderRadius, Gradients } from '../../theme/DesignSystem';
import { MotiView } from 'moti';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const FEATURES = [
    { icon: 'infinity', title: 'Unlimited Recordings', description: 'No 5-recording limit' },
    { icon: 'note-text', title: 'Unlimited Notes', description: 'No 7-note limit' },
    { icon: 'folder-multiple', title: 'Unlimited Folders', description: 'No 2-folder limit' },
    { icon: 'chart-box', title: 'Pro Insights', description: 'Reflection heatmap & analytics' },
    { icon: 'fire', title: 'Streak Tracking', description: 'Daily consistency gamification' },
    { icon: 'school', title: 'Smart Study Mode', description: 'Memorization helper' },
];

const MONTHLY_PRICE = 4.99;
const ANNUAL_PRICE = 35.99;

export default function PaywallScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { reason } = useLocalSearchParams<{ reason?: string }>();
    const { isPro, checkStatus } = usePro();
    const [offering, setOffering] = useState<PurchasesOffering | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasing, setPurchasing] = useState(false);
    const [isAnnual, setIsAnnual] = useState(true);

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
                    highlightIndex: 3
                };
            default:
                return {
                    title: 'QuranNotes Pro',
                    subtitle: 'Unlock your full spiritual potential',
                    highlightIndex: null
                };
        }
    };

    const contextMessage = getMessage();

    useEffect(() => {
        loadOfferings();
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
            const success = await revenueCatService.purchasePackage(packageToBuy);
            if (success) {
                checkStatus();
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert('Success', 'You are now a Pro member!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            }
        } catch (error) {
            console.error('Purchase failed:', error);
            // RevenueCatService handles alert already usually, but we can add one if needed
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
            router.back();
        } else {
            Alert.alert('Error', 'Could not restore purchases.');
        }
    };

    const price = isAnnual ? ANNUAL_PRICE : MONTHLY_PRICE;
    const savings = isAnnual ? Math.round((1 - ANNUAL_PRICE / 12 / MONTHLY_PRICE) * 100) : 0;

    if (loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <LinearGradient
            colors={Gradients.primary}
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
                                        name={feature.icon as any}
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

                    {/* Pricing Toggle */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', delay: 800 }}
                        style={styles.pricingContainer}>
                        <View style={styles.toggleRow}>
                            <Text style={styles.toggleLabel}>Monthly</Text>
                            <Switch
                                value={isAnnual}
                                onValueChange={setIsAnnual}
                                trackColor={{
                                    false: 'rgba(255,255,255,0.3)',
                                    true: 'rgba(255,255,255,0.5)',
                                }}
                                thumbColor="#FFFFFF"
                            />
                            <View style={styles.annualLabel}>
                                <Text style={styles.toggleLabel}>Annual</Text>
                                {isAnnual && (
                                    <View style={styles.savingsBadge}>
                                        <Text style={styles.savingsText}>-{savings}%</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        <View style={styles.priceDisplay}>
                            <Text style={styles.price}>${price.toFixed(2)}</Text>
                            <Text style={styles.priceUnit}>/{isAnnual ? 'year' : 'month'}</Text>
                        </View>
                        {isAnnual && (
                            <Text style={styles.priceNote}>
                                Just ${(ANNUAL_PRICE / 12).toFixed(2)}/month
                            </Text>
                        )}
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
                        style={styles.ctaButton}
                        labelStyle={styles.ctaLabel}
                        buttonColor="#FFFFFF"
                        textColor="#5B7FFF"
                        loading={purchasing}
                        disabled={purchasing}>
                        Unlock Full Access
                    </Button>
                    <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
                        <Text style={styles.secondaryText}>Maybe Later</Text>
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
});
