import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, useTheme, HelperText } from 'react-native-paper';
import { useRouter, Link, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing, BorderRadius, Colors } from '../../src/presentation/theme/DesignSystem';
import { useAuth } from '../../src/infrastructure/auth/AuthContext';
import { MotiView } from 'moti';

export default function SignUpScreen() {
    const theme = useTheme();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { registerWithEmail } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [secureTextEntry, setSecureTextEntry] = useState(true);

    const handleSignUp = async () => {
        if (!email || !password || !confirmPassword) {
            setError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        setLoading(true);
        setError('');
        try {
            await registerWithEmail(email, password);

            // Show modern toast notification
            const Toast = require('react-native-toast-message').default;
            Toast.show({
                type: 'success',
                text1: '✅ Account Created!',
                text2: 'Verification email sent. Check your inbox or junk/spam folder.',
                visibilityTime: 5000,
                position: 'top',
            });
            // Navigate to login after short delay
            setTimeout(() => {
                // No change needed here yet
            }, 1500);
        } catch (e: any) {
            setError(e.message || 'Registration failed');
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

                    <TextInput
                        mode="outlined"
                        label="Confirm Password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
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
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 'auto',
        paddingVertical: Spacing.xl,
    },
});
