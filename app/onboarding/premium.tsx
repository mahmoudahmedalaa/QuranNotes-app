import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Switch, Dimensions } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Icon } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const FEATURES = [
    { icon: 'infinity', title: 'Unlimited Recordings', description: 'No 10-recording limit' },
    { icon: 'chart-box', title: 'Pro Insights', description: 'Reflection heatmap & analytics' },
    { icon: 'fire', title: 'Streak Tracking', description: 'Daily consistency gamification' },
    { icon: 'cloud-sync', title: 'Cloud Sync', description: 'Backup across all devices' },
    { icon: 'school', title: 'Smart Study Mode', description: 'Memorization helper' },
    { icon: 'file-export', title: 'Data Export', description: 'PDF & JSON downloads' },
];

const MONTHLY_PRICE = 4.99;
const ANNUAL_PRICE = 35.99;

export default function OnboardingPremium() {
    const theme = useTheme();
    const router = useRouter();
    const { highlight } = useLocalSearchParams();
    const { completeOnboarding } = useOnboarding();
    const [isAnnual, setIsAnnual] = useState(true);

    const highlightIndex = highlight ? parseInt(highlight as string) : null;

    const handleSubscribe = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // TODO: Integrate with RevenueCat
        console.log('Subscribing to:', isAnnual ? 'annual' : 'monthly');
        await completeOnboarding();
        router.replace('/');
    };

    const handleStartFree = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await completeOnboarding();
        router.replace('/');
    };

    const price = isAnnual ? ANNUAL_PRICE : MONTHLY_PRICE;
    const savings = isAnnual ? Math.round((1 - ANNUAL_PRICE / 12 / MONTHLY_PRICE) * 100) : 0;

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
                    <Text style={styles.title}>QuranNotes Pro</Text>
                    <Text style={styles.subtitle}>Unlock your full spiritual potential</Text>
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
                                <Icon
                                    source={feature.icon as any}
                                    size={20}
                                    color="rgba(255,255,255,0.9)"
                                />
                            </View>
                            <View style={styles.featureText}>
                                <Text style={styles.featureTitle}>{feature.title}</Text>
                                <Text style={styles.featureDescription}>{feature.description}</Text>
                            </View>
                            <Icon source="check-circle" size={22} color="#4ADE80" />
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

                {/* CTA Buttons */}
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 1000 }}
                    style={styles.ctaContainer}>
                    <Button
                        mode="contained"
                        onPress={handleSubscribe}
                        style={styles.ctaButton}
                        labelStyle={styles.ctaLabel}
                        buttonColor="#FFFFFF"
                        textColor="#5B7FFF">
                        Unlock Full Access
                    </Button>
                    <Pressable onPress={handleStartFree} style={styles.secondaryButton}>
                        <Text style={styles.secondaryText}>Start Free</Text>
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
        color: '#FFFFFF',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        marginTop: Spacing.xs,
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
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '500',
    },
});
