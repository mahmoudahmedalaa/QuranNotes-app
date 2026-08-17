import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText } from 'react-native-paper';
import { useRouter, Link, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, BorderRadius, Colors } from '../../src/core/theme/DesignSystem';
import { useAuth } from '../../src/features/auth/infrastructure/AuthContext';
import {
    getAuthErrorMessage,
    getSignUpPasswordError,
} from '../../src/features/auth/presentation/authErrorMessage';
import { MotiView } from 'moti';
import Toast from 'react-native-toast-message';

export default function SignUpScreen() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { user, registerWithEmail, loginWithGoogle, loginWithApple } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [secureTextEntry, setSecureTextEntry] = useState(true);

    // If user is already authenticated on mount (persisted session), go straight to home.
    React.useEffect(() => {
        if (user) {
            router.replace('/');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const handleSignUp = async () => {
        if (!email || !password || !confirmPassword) {
            setError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        const passwordError = getSignUpPasswordError(password);
        if (passwordError) {
            setError(passwordError);
            return;
        }

        setLoading(true);
        setError('');
        try {
            await registerWithEmail(email, password);

            // Show modern toast notification
            Toast.show({
                type: 'success',
                text1: 'Account Created!',
                text2: 'Welcome to QuranNotes.',
                visibilityTime: 3000,
                position: 'top',
            });
            // Redirect to index router to handle the next screen (onboarding, welcome, or home)
            router.replace('/');
        } catch (e: unknown) {
            setError(getAuthErrorMessage(e, "We couldn't create your account. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithGoogle();
            router.replace('/');
        } catch (e: unknown) {
            setError(getAuthErrorMessage(e, "We couldn't sign you in with Google. Please try again."));
        } finally {
            setLoading(false);
        }
    };

    const handleAppleSignUp = async () => {
        setLoading(true);
        setError('');
        try {
            await loginWithApple();
            router.replace('/');
        } catch (e: unknown) {
            setError(getAuthErrorMessage(e, "We couldn't sign you in with Apple. Please try again."));
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
                            Create Account
                        </Text>
                        <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant, marginTop: Spacing.xs }}>
                            Join us to track your Quran journey
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
                        onChangeText={(value) => {
                            setEmail(value);
                            setError('');
                        }}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        style={styles.input}
                        error={!!error}
                    />

                    <TextInput
                        mode="outlined"
                        label="Password"
                        value={password}
                        onChangeText={(value) => {
                            setPassword(value);
                            setError('');
                        }}
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

                    <TextInput
                        mode="outlined"
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={(value) => {
                            setConfirmPassword(value);
                            setError('');
                        }}
                        secureTextEntry={secureTextEntry}
                        style={styles.input}
                        error={!!error}
                    />

                    <HelperText type="error" visible={!!error}>
                        {error}
                    </HelperText>

                    <Button
                        mode="contained"
                        onPress={handleSignUp}
                        loading={loading}
                        disabled={loading}
                        style={styles.button}
                        contentStyle={{ height: 50 }}
                    >
                        Sign Up
                    </Button>

                    <View style={styles.dividerContainer}>
                        <View style={styles.divider} />
                        <Text style={{ marginHorizontal: Spacing.md, color: theme.colors.outline }}>OR</Text>
                        <View style={styles.divider} />
                    </View>

                    <Button
                        mode="outlined"
                        onPress={handleGoogleSignUp}
                        disabled={loading}
                        style={styles.socialButton}
                        icon="google"
                        textColor={theme.colors.onSurface}
                        contentStyle={{ height: 50 }}
                    >
                        Continue with Google
                    </Button>

                    <Button
                        mode="outlined"
                        onPress={handleAppleSignUp}
                        disabled={loading}
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
                        Already have an account?{' '}
                    </Text>
                    <Link href="/(auth)/login" asChild>
                        <Button mode="text" compact>Sign In</Button>
                    </Link>
                </MotiView>
            </ScrollView>
        </KeyboardAvoidingView>
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
