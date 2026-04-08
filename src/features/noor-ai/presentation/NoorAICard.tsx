/**
 * NoorAICard — Dashboard hero card for the Noor AI companion.
 *
 * Premium gradient card with:
 *  - Noor branding with sparkle icon
 *  - Time-of-day contextual greeting  
 *  - Remaining messages badge (free users)
 *  - One-tap navigation to the Noor AI chat screen
 *
 * Visually distinct from TadabburCard: uses warm gold → violet gradient
 * vs Tadabbur's cool purple gradient.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { usePro } from '../../auth/infrastructure/ProContext';
import { getRemainingMessages, DAILY_LIMIT } from '../domain/NoorUsageService';
import { Spacing } from '../../../core/theme/DesignSystem';

function getTimeGreeting(): string {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Start your morning with Quran insights ☀️';
    if (hour >= 12 && hour < 17) return 'Deepen your knowledge this afternoon 🌤️';
    if (hour >= 17 && hour < 21) return 'Reflect on the Quran this evening 🌅';
    return 'Let the Quran illuminate your night 🌙';
}

export default function NoorAICard() {
    const theme = useTheme();
    const router = useRouter();
    const { isPro } = usePro();
    const [remaining, setRemaining] = useState(DAILY_LIMIT);

    useEffect(() => {
        if (!isPro) {
            getRemainingMessages().then(setRemaining);
        }
    }, [isPro]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        router.push('/noor-ai');
    };

    // Warm gold → deep violet gradient (distinct from Tadabbur's cool purple)
    const gradientColors: readonly [string, string, ...string[]] = theme.dark
        ? ['#2D1F6E', '#1A1040']
        : ['#7C3AED', '#4B2FD4'];

    const subtitleText = isPro
        ? 'Unlimited AI conversations'
        : `${remaining} free questions left today`;

    return (
        <MotiView
            from={{ opacity: 0, translateY: 12 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 18, delay: 0 }}
            style={styles.cardWrapper}
        >
            <Pressable
                onPress={handlePress}
                style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}
            >
                <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.card}
                >
                    {/* Top row: icon + title */}
                    <View style={styles.topRow}>
                        <View style={styles.iconCircle}>
                            <MaterialCommunityIcons
                                name="star-four-points"
                                size={22}
                                color="#FFFFFF"
                            />
                        </View>
                        <View style={styles.titleBlock}>
                            <View style={styles.titleRow}>
                                <Text style={styles.title}>Noor AI</Text>
                                <Text style={styles.sparkle}>✨</Text>
                            </View>
                            <Text style={styles.subtitle}>
                                {getTimeGreeting()}
                            </Text>
                        </View>
                        <MaterialCommunityIcons
                            name="chevron-right"
                            size={24}
                            color="rgba(255,255,255,0.7)"
                        />
                    </View>

                    {/* Divider */}
                    <View style={styles.divider} />

                    {/* Bottom row: usage info + CTA */}
                    <View style={styles.bottomRow}>
                        <View style={styles.statPill}>
                            <MaterialCommunityIcons
                                name="chat-processing-outline"
                                size={14}
                                color="rgba(255,255,255,0.8)"
                            />
                            <Text style={styles.statText}>{subtitleText}</Text>
                        </View>
                        <View style={styles.ctaChip}>
                            <Text style={styles.ctaText}>Ask Noor</Text>
                        </View>
                    </View>
                </LinearGradient>
            </Pressable>
        </MotiView>
    );
}

const styles = StyleSheet.create({
    cardWrapper: {
        paddingHorizontal: Spacing.md,
    },
    card: {
        borderRadius: 20,
        padding: 20,
        overflow: 'hidden',
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(255,255,255,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    titleBlock: {
        flex: 1,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    title: {
        color: '#FFFFFF',
        fontSize: 20,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sparkle: {
        fontSize: 16,
    },
    subtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
        marginTop: 2,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.12)',
        marginVertical: 14,
    },
    bottomRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
    },
    ctaChip: {
        backgroundColor: 'rgba(255,255,255,0.22)',
        paddingHorizontal: 16,
        paddingVertical: 7,
        borderRadius: 14,
    },
    ctaText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
});
