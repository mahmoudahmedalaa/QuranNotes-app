import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { PremiumTheme } from '../../theme/DesignSystem';
import { router } from 'expo-router';

export const AnonymousLoginScreen = () => {
    const { loginAnonymously } = useAuth();
    // Force type safety by using our custom theme object directly or casting
    const colors = PremiumTheme.colors as typeof PremiumTheme.colors & { muted: string };
    const fonts = PremiumTheme.fonts;
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleLogin = async () => {
        try {
            setIsSigningIn(true);
            await loginAnonymously();
            router.replace('/(tabs)');
        } catch (error: unknown) {
            if (__DEV__) console.error('Login failed:', error);
            // Show specific error to help diagnosis
            const err = error as { code?: string; message?: string };
            const message = err.code || err.message || 'Unknown error';
            alert(`Sign In Failed: ${message}`);
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Hero Section */}
            <View style={styles.heroContent}>
                <Text style={[styles.title, { color: colors.primary, ...fonts.displayLarge }]}>
                    QuranNotes
                </Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                    Reflect. Record. Remember.
                </Text>
            </View>

            {/* Action Section */}
            <View style={styles.actionContainer}>
                <Button
                    mode="contained"
                    onPress={handleLogin}
                    loading={isSigningIn}
                    disabled={isSigningIn}
                    contentStyle={styles.buttonContent}
                    style={styles.button}
                    labelStyle={styles.buttonLabel}>
                    Start Reading
                </Button>

                <Text style={[styles.footerText, { color: colors.muted }]}>
                    No account required. Your data stays on your device.
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 32,
    },
    heroContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 18,
        letterSpacing: 0.5,
    },
    actionContainer: {
        gap: 16,
        marginBottom: 48,
    },
    button: {
        borderRadius: 16,
        elevation: 4,
    },
    buttonContent: {
        height: 56,
    },
    buttonLabel: {
        fontSize: 18,
        fontWeight: '600',
        letterSpacing: 1,
    },
    footerText: {
        textAlign: 'center',
        fontSize: 12,
    },
});
