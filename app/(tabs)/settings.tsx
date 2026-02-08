import { View, StyleSheet, ScrollView, Pressable, Alert, Platform, Switch } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../src/infrastructure/settings/SettingsContext';
import { ReciterPicker } from '../../src/presentation/components/common/ReciterPicker';
import { getReciterById } from '../../src/domain/entities/Reciter';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
    Colors,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';
import { usePro } from '../../src/infrastructure/auth/ProContext';
import { useAuth } from '../../src/infrastructure/auth/AuthContext';
import { NotificationService } from '../../src/infrastructure/notifications/NotificationService';

export default function SettingsScreen() {
    const theme = useTheme();
    const router = require('expo-router').useRouter();
    const { settings, updateSettings, resetSettings } = useSettings();

    const { toggleDebugPro, isPro } = usePro();
    const { user, loading, logout, deleteAccount } = useAuth();
    const [reciterPickerVisible, setReciterPickerVisible] = useState(false);

    const handleSignOut = async () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    await logout();
                    Alert.alert('Signed Out', 'You have been signed out.');
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'This will permanently delete your account and all your data. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                        // Double confirmation for destructive action
                        Alert.alert(
                            'Are you absolutely sure?',
                            'All your notes, recordings, and settings will be permanently lost.',
                            [
                                { text: 'Cancel', style: 'cancel' },
                                {
                                    text: 'Yes, Delete My Account',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                            await deleteAccount();
                                            router.replace('/(auth)/login');
                                        } catch (e: any) {
                                            // Handle Firebase re-auth requirement gracefully
                                            const msg = e?.message || '';
                                            if (msg.includes('sign out') || msg.includes('recent')) {
                                                Alert.alert(
                                                    'Quick Security Step',
                                                    'For your protection, please sign in again before deleting. We\'ll sign you out now — just sign back in and try again.',
                                                    [
                                                        { text: 'Not Now', style: 'cancel' },
                                                        {
                                                            text: 'Sign Out Now',
                                                            onPress: async () => {
                                                                try {
                                                                    await logout();
                                                                    router.replace('/(auth)/login');
                                                                } catch { /* ignore */ }
                                                            },
                                                        },
                                                    ]
                                                );
                                            } else {
                                                Alert.alert(
                                                    'Could Not Delete',
                                                    'Something went wrong. Please try again later.',
                                                );
                                            }
                                        }
                                    },
                                },
                            ]
                        );
                    },
                },
            ]
        );
    };

    const toggleDarkMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' });
    };

    const handleReciterSelect = (reciterId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        updateSettings({ reciterId });
    };

    const handleToggleReminder = async (enabled: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (enabled) {
            const granted = await NotificationService.requestPermissions();
            if (!granted) {
                Alert.alert(
                    'Notifications Disabled',
                    'Please enable notifications in your device Settings to receive daily reminders.',
                );
                return;
            }
            await NotificationService.scheduleDailyReminder(settings.dailyReminderHour, settings.dailyReminderMinute);
        } else {
            await NotificationService.cancelDailyReminder();
        }
        await updateSettings({ dailyReminderEnabled: enabled });
    };

    const handlePickReminderTime = () => {
        // Build time options for a simple picker
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const options = hours.map(h => `${h.toString().padStart(2, '0')}:00`);
        options.push('Cancel');

        Alert.alert(
            'Set Reminder Time',
            `Current: ${settings.dailyReminderHour.toString().padStart(2, '0')}:${settings.dailyReminderMinute.toString().padStart(2, '0')}`,
            [
                { text: 'Morning (06:00)', onPress: () => saveReminderTime(6, 0) },
                { text: 'Afternoon (14:00)', onPress: () => saveReminderTime(14, 0) },
                { text: 'Evening (20:00)', onPress: () => saveReminderTime(20, 0) },
                { text: 'Night (22:00)', onPress: () => saveReminderTime(22, 0) },
                { text: 'Cancel', style: 'cancel' },
            ]
        );
    };

    const saveReminderTime = async (hour: number, minute: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await updateSettings({ dailyReminderHour: hour, dailyReminderMinute: minute });
        if (settings.dailyReminderEnabled) {
            await NotificationService.scheduleDailyReminder(hour, minute);
        }
    };



    return (
        <LinearGradient
            colors={theme.dark ? ['#0F1419', '#1A1F26'] : (Gradients.sereneSky as any)}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: theme.colors.onBackground }]}>
                        Settings
                    </Text>
                </View>

                <ScrollView
                    style={[styles.content, { backgroundColor: theme.colors.background }]}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}>

                    {/* Account Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            ACCOUNT
                        </Text>
                        {user ? (
                            // Logged in state
                            <View>
                                <View
                                    style={[
                                        styles.card,
                                        { backgroundColor: theme.colors.surface, marginBottom: Spacing.sm },
                                        Shadows.sm,
                                    ]}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme.colors.primaryContainer },
                                        ]}>
                                        <Ionicons
                                            name="person"
                                            size={18}
                                            color={theme.colors.primary}
                                        />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                            {user.email || user.displayName || 'Signed In'}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardSubtitle,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            {user.isAnonymous ? 'Anonymous User' : 'Verified Account'}
                                        </Text>
                                    </View>
                                </View>

                                {/* Upgrade Button (Visible if not Pro) */}
                                {!isPro && (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.card,
                                            { backgroundColor: theme.colors.surface, marginBottom: Spacing.sm },
                                            Shadows.sm,
                                            pressed && styles.cardPressed,
                                        ]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                            router.push('/paywall');
                                        }}>
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { backgroundColor: Colors.secondary || '#FFD700' },
                                            ]}>
                                            <Ionicons name="star" size={18} color="white" />
                                        </View>
                                        <View style={styles.cardContent}>
                                            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                                Upgrade to Pro
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cardSubtitle,
                                                    { color: theme.colors.onSurfaceVariant },
                                                ]}>
                                                Unlock AI insights & more
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name="chevron-forward"
                                            size={20}
                                            color={theme.colors.onSurfaceVariant}
                                        />
                                    </Pressable>
                                )}

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.card,
                                        { backgroundColor: theme.colors.surface },
                                        Shadows.sm,
                                        pressed && styles.cardPressed,
                                    ]}
                                    onPress={handleSignOut}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme.colors.errorContainer || '#FFEBEE' },
                                        ]}>
                                        <Ionicons name="log-out" size={18} color={theme.colors.error} />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.error }]}>
                                            Sign Out
                                        </Text>
                                    </View>
                                </Pressable>

                                <Pressable
                                    style={({ pressed }) => [
                                        styles.card,
                                        { backgroundColor: theme.colors.surface, marginTop: Spacing.sm },
                                        Shadows.sm,
                                        pressed && styles.cardPressed,
                                    ]}
                                    onPress={handleDeleteAccount}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme.colors.errorContainer || '#FFEBEE' },
                                        ]}>
                                        <Ionicons name="trash" size={18} color={theme.colors.error} />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.error }]}>
                                            Delete Account
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardSubtitle,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            Permanently remove your account and data
                                        </Text>
                                    </View>
                                </Pressable>
                            </View>
                        ) : (
                            // Logged out state
                            <Pressable
                                style={({ pressed }) => [
                                    styles.card,
                                    { backgroundColor: theme.colors.surface },
                                    Shadows.sm,
                                    pressed && styles.cardPressed,
                                ]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    router.push('/(auth)/login');
                                }}>
                                <View
                                    style={[
                                        styles.iconContainer,
                                        { backgroundColor: theme.colors.primaryContainer },
                                    ]}>
                                    <Ionicons
                                        name="log-in"
                                        size={18}
                                        color={theme.colors.primary}
                                    />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                        Sign In / Create Account
                                    </Text>
                                    <Text
                                        style={[
                                            styles.cardSubtitle,
                                            { color: theme.colors.onSurfaceVariant },
                                        ]}>
                                        Sync your notes across devices
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={theme.colors.onSurfaceVariant}
                                />
                            </Pressable>
                        )}
                    </View>

                    {/* Audio Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            AUDIO
                        </Text>
                        <Pressable
                            style={({ pressed }) => [
                                styles.card,
                                { backgroundColor: theme.colors.surface },
                                Shadows.sm,
                                pressed && styles.cardPressed,
                            ]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setReciterPickerVisible(true);
                            }}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: theme.colors.primaryContainer },
                                ]}>
                                <Ionicons
                                    name="musical-notes"
                                    size={18}
                                    color={theme.colors.primary}
                                />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Reciter
                                </Text>
                                <Text
                                    style={[
                                        styles.cardSubtitle,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {getReciterById(settings.reciterId).name}
                                </Text>
                            </View>
                            <Ionicons
                                name="chevron-forward"
                                size={20}
                                color={theme.colors.onSurfaceVariant}
                            />
                        </Pressable>
                    </View>

                    {/* Appearance Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            APPEARANCE
                        </Text>
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: theme.colors.surface },
                                Shadows.sm,
                            ]}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: theme.colors.primaryContainer },
                                ]}>
                                <Ionicons name="moon" size={18} color={theme.colors.primary} />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Dark Mode
                                </Text>
                            </View>
                            <Switch
                                value={settings.theme === 'dark'}
                                onValueChange={toggleDarkMode}
                                trackColor={{ false: '#D0D0D0', true: theme.colors.primary }}
                                thumbColor={settings.theme === 'dark' ? '#FFF' : '#F4F4F4'}
                            />
                        </View>
                    </View>

                    {/* Notifications Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            NOTIFICATIONS
                        </Text>
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: theme.colors.surface },
                                Shadows.sm,
                            ]}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: theme.colors.tertiaryContainer || '#E8DEF8' },
                                ]}>
                                <Ionicons name="notifications" size={18} color={theme.colors.tertiary || '#7C4DFF'} />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Daily Reminder
                                </Text>
                                <Text
                                    style={[
                                        styles.cardSubtitle,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    {settings.dailyReminderEnabled
                                        ? `${settings.dailyReminderHour.toString().padStart(2, '0')}:${settings.dailyReminderMinute.toString().padStart(2, '0')}`
                                        : 'Off'}
                                </Text>
                            </View>
                            <Switch
                                value={settings.dailyReminderEnabled}
                                onValueChange={handleToggleReminder}
                                trackColor={{ false: '#D0D0D0', true: theme.colors.primary }}
                                thumbColor={settings.dailyReminderEnabled ? '#FFF' : '#F4F4F4'}
                            />
                        </View>
                        {settings.dailyReminderEnabled && (
                            <>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.card,
                                        { backgroundColor: theme.colors.surface, marginTop: Spacing.sm },
                                        Shadows.sm,
                                        pressed && styles.cardPressed,
                                    ]}
                                    onPress={handlePickReminderTime}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme.colors.primaryContainer },
                                        ]}>
                                        <Ionicons name="time" size={18} color={theme.colors.primary} />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                            Reminder Time
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardSubtitle,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            {settings.dailyReminderHour.toString().padStart(2, '0')}:{settings.dailyReminderMinute.toString().padStart(2, '0')}
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                </Pressable>
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.card,
                                        { backgroundColor: theme.colors.surface, marginTop: Spacing.sm },
                                        Shadows.sm,
                                        pressed && styles.cardPressed,
                                    ]}
                                    onPress={async () => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        await NotificationService.sendTestNotification();
                                    }}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: '#E3F2FD' },
                                        ]}>
                                        <Ionicons name="paper-plane" size={18} color="#1976D2" />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                            Preview Notification
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardSubtitle,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            See what it looks like (arrives in 3s)
                                        </Text>
                                    </View>
                                </Pressable>
                            </>
                        )}
                    </View>

                    {/* About Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            ABOUT
                        </Text>
                        <View
                            style={[
                                styles.card,
                                { backgroundColor: theme.colors.surface },
                                Shadows.sm,
                            ]}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: theme.colors.secondaryContainer },
                                ]}>
                                <Ionicons
                                    name="information"
                                    size={18}
                                    color={theme.colors.secondary}
                                />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Version
                                </Text>
                                <Text
                                    style={[
                                        styles.cardSubtitle,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    1.0.0
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Debug Section */}

                </ScrollView>

                <ReciterPicker
                    visible={reciterPickerVisible}
                    onDismiss={() => setReciterPickerVisible(false)}
                    onSelect={handleReciterSelect}
                    selectedReciter={settings.reciterId}
                />
            </SafeAreaView>
        </LinearGradient >
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
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: '800',
        letterSpacing: -0.5,
    },
    content: {
        flex: 1,
        borderTopLeftRadius: BorderRadius.xxl,
        borderTopRightRadius: BorderRadius.xxl,
    },
    scrollContent: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.xxl,
    },
    promoCard: {
        borderRadius: BorderRadius.xl,
        overflow: 'hidden',
    },
    promoCardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
        gap: Spacing.md,
    },
    section: {
        marginBottom: Spacing.lg,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: Spacing.sm,
        marginLeft: Spacing.sm,
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
        borderRadius: BorderRadius.lg,
    },
    cardPressed: {
        opacity: 0.95,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: BorderRadius.md,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    cardContent: {
        flex: 1,
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: '600',
    },
    cardSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
});
