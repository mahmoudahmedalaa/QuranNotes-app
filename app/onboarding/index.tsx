import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import { Spacing, BorderRadius, Gradients } from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function OnboardingWelcome() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep } = useOnboarding();

    const handleBegin = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        goToStep(2);
        router.push('/onboarding/pick-surah');
    };

    return (
        <LinearGradient
            colors={Gradients.primary}
            style={styles.container}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}>
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.content}>
                    {/* Logo/Icon */}
                    <MotiView
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: 200 }}
                        style={styles.iconContainer}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="book" size={48} color="#5B7FFF" />
                        </View>
                    </MotiView>

                    {/* Title */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 600, delay: 400 }}>
                        <Text style={styles.title}>Deepen Your{'\n'}Quran Journey</Text>
                    </MotiView>

                    {/* Subtitle */}
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 600, delay: 600 }}>
                        <Text style={styles.subtitle}>
                            Record reflections, track consistency,{'\n'}grow spiritually
                        </Text>
                    </MotiView>

                    {/* Features Preview */}
                    <MotiView
                        from={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ type: 'timing', duration: 600, delay: 800 }}
                        style={styles.featuresContainer}>
                        <FeatureItem icon="mic" text="Voice Reflections" />
                        <FeatureItem icon="flame" text="Track Streaks" />
                        <FeatureItem icon="cloud" text="Cloud Sync" />
                        {/* <FeatureItem icon="text-recognition" text="Follow Along" /> REMOVED */}
                    </MotiView>
                </View>

                {/* CTA Button */}
                <MotiView
                    from={{ opacity: 0, translateY: 30 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 1000 }}
                    style={styles.ctaContainer}>
                    <Button
                        mode="contained"
                        onPress={handleBegin}
                        style={styles.ctaButton}
                        labelStyle={styles.ctaLabel}
                        buttonColor="#FFFFFF"
                        textColor="#5B7FFF">
                        Begin
                    </Button>
                </MotiView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => {
    // Split text by space to stack words
    const words = text.split(' ');

    return (
        <View style={styles.featureItem}>
            <Ionicons name={icon as any} size={24} color="rgba(255,255,255,0.9)" />
            <View style={{ alignItems: 'center' }}>
                {words.map((word, index) => (
                    <Text key={index} style={styles.featureText}>
                        {word}
                    </Text>
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        justifyContent: 'space-between',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    iconContainer: {
        marginBottom: Spacing.xl,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255,255,255,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
    },
    title: {
        fontSize: 32, // Slightly smaller to prevent wrapping issues on small screens
        fontWeight: '800',
        color: '#FFFFFF',
        textAlign: 'center',
        letterSpacing: -0.5,
        lineHeight: 40,
        marginBottom: Spacing.md,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.85)',
        textAlign: 'center',
        lineHeight: 24,
        paddingHorizontal: Spacing.xl, // Prevent edge touching
    },
    featuresContainer: {
        flexDirection: 'row',
        marginTop: Spacing.xxl,
        justifyContent: 'center',
        gap: Spacing.xl, // Increased gap
        width: '100%',
    },
    featureItem: {
        alignItems: 'center',
        gap: Spacing.sm,
        minWidth: 80, // Ensure even spacing
    },
    featureText: {
        fontSize: 13, // Slightly larger
        color: 'rgba(255,255,255,0.9)', // Higher contrast
        fontWeight: '600',
        textAlign: 'center',
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
});
