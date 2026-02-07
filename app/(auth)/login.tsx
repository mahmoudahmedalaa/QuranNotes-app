import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, IconButton, useTheme, HelperText } from 'react-native-paper';
import { useRouter, Link, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, BorderRadius, Colors } from '../../src/presentation/theme/DesignSystem';
import { useAuth } from '../../src/infrastructure/auth/AuthContext';
import { MotiView } from 'moti';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';

export default function LoginScreen() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, loginWithEmail, loginAnonymously, loginWithGoogle, loginWithApple } = useAuth();
    const { completeOnboarding } = useOnboarding();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [secureTextEntry, setSecureTextEntry] = useState(true);

    // Redirect to home if already logged in (persistence check)
    React.useEffect(() => {
        if (user) {
            checkOnboardingAndRedirect();
        }
    }, [user]);

    const checkOnboardingAndRedirect = async () => {
        // For Login flow, we assume the user either:
        // 1. Has already onboarded (if returning)
        // 2. Or is an existing user logging in on new device (wants to skip)
        // 3. Or user explicity chose "Login" instead of "Signup" -> Skip onboarding

        await completeOnboarding();
        router.replace('/');
    };

    const handleLogin = async () => {
        if (!email || !password) {
            setError('Please fill in all fields');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await loginWithEmail(email, password);

            // Check if email is verified using Firebase compat API
            const firebase = require('firebase/compat/app').default;
            const currentUser = firebase.auth().currentUser;

            if (currentUser && !currentUser.emailVerified) {
                // Sign out unverified user
                await firebase.auth().signOut();

                // Show toast notification
                const Toast = require('react-native-toast-message').default;
                Toast.show({
                    type: 'info',
                    text1: '📧 Email Not Verified',
                    text2: 'Please verify your email before signing in. Check spam/junk folder.',
                    visibilityTime: 5000,
                    position: 'top',
                });
                return;
            }

            router.replace('/');
        } catch (e: any) {
            setError(e.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithGoogle();
            router.replace('/');
        } catch (e: any) {
            setError(e.message || 'Google Sign-In failed');
        } finally {
            setLoading(false);
        }
    };

    const handleAppleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithApple();
            router.replace('/');
        } catch (e: any) {
            setError(e.message || 'Apple Sign-In failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={[styles.header, { marginTop: insets.top + Spacing.xl }]}>
                    <MotiView
                        from={{ opacity: 0, translateY: 20 }}
                        animate={{ opacity: 1, translateY: 0 }}
                        transition={{ type: 'timing', duration: 1000 }}>
                        <Text variant="displaySmall" style={{ fontWeight: '700', color: theme.colors.primary }}>
                            Welcome Back
                        </Text>
                        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: Spacing.xs }}>
                            Sign in to continue your journey
                        </Text>
                    </MotiView>
                </View>

                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 1000, delay: 200 }}
                    style={styles.form}>

                    <TextInput
                        mode="outlined"
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                        error={!!error}
                    />

                    <TextInput
                        mode="outlined"
                        label="Password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={secureTextEntry}
                        style={styles.input}
                        right={
                            <TextInput.Icon
                                icon={secureTextEntry ? "eye" : "eye-off"}
                                onPress={() => setSecureTextEntry(!secureTextEntry)}
                            />
                        }
                        error={!!error}
                    />

                    <HelperText type="error" visible={!!error}>
                        {error}
                    </HelperText>

                    <Button
                        mode="contained"
                        onPress={handleLogin}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                        contentStyle={{ height: 50 }}
                    >
                        Sign In
                    </Button>

                    <Button
                        mode="text"
                        onPress={() => {
                            const router = require('expo-router').useRouter;
                            require('expo-router').router.push('/(auth)/forgot-password');
                        }}
                        style={{ marginTop: Spacing.sm }}
                        textColor={theme.colors.primary}
                    >
                        Forgot Password?
                    </Button>

                    <View style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={{ marginHorizontal: Spacing.md, color: theme.colors.outline }}>OR</Text>
                        <View style={styles.divider} />
                    </View>

                    <Button
                        mode="outlined"
                        onPress={handleGoogleLogin}
                        style={styles.socialButton}
                        icon="google"
                        textColor={theme.colors.onSurface}
                        contentStyle={{ height: 50 }}
                    >
                        Continue with Google
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={handleAppleLogin}
                        style={styles.socialButton}
                        icon="apple"
                        textColor={theme.colors.onSurface}
                        contentStyle={{ height: 50 }}
                    >
                        Continue with Apple
                    </Button>
                </MotiView>

                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 500 }}
                    style={styles.footer}
                >
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        Don't have an account?{' '}
                    </Text>
                    <Link href="/(auth)/sign-up" asChild>
                        <Button mode="text" compact>Sign Up</Button>
                    </Link>
                </MotiView>
            </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        flexGrow: 1,
        padding: Spacing.lg,
    },
    header: {
        marginBottom: Spacing.xxl,
    },
    form: {
        gap: Spacing.sm,
    },
    input: {
        backgroundColor: 'transparent',
    },
    button: {
        marginTop: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    socialButton: {
        borderColor: Colors.outline,
        borderRadius: BorderRadius.lg,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: Spacing.xl,
    },
    divider: {
        flex: 1,
        height: 1,
        backgroundColor: Colors.outline,
        opacity: 0.3,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 'auto',
        paddingVertical: Spacing.xl,
    },
});
