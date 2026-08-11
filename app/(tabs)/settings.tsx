import { View, StyleSheet, ScrollView, Pressable, Alert, Switch as RNSwitch, LayoutAnimation, Platform, UIManager, Linking } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useState, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSettings } from '../../src/features/settings/infrastructure/SettingsContext';
import { ReciterPicker } from '../../src/core/components/common/ReciterPicker';
import { getReciterById } from '../../src/features/audio-player/domain/Reciter';
import { getEditionById, getAvailableLanguages } from '../../src/core/domain/entities/TranslationEdition';
import { QURAN_FONT_OPTIONS, getQuranFontOption } from '../../src/core/theme/QuranFonts';
import type { QuranFontId } from '../../src/core/theme/QuranFonts';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
    Colors,
} from '../../src/core/theme/DesignSystem';
import * as Haptics from 'expo-haptics';
import { usePro } from '../../src/features/auth/infrastructure/ProContext';
import { useAuth } from '../../src/features/auth/infrastructure/AuthContext';


import { NotificationService } from '../../src/features/notifications/infrastructure/NotificationService';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRAYER_TIMES = [
    { label: 'Fajr', icon: 'partly-sunny-outline' as const, key: 'Fajr', hour: 5, minute: 30, desc: '5:30 AM' },
    { label: 'Dhuhr', icon: 'sunny-outline' as const, key: 'Dhuhr', hour: 12, minute: 30, desc: '12:30 PM' },
    { label: 'Asr', icon: 'partly-sunny-outline' as const, key: 'Asr', hour: 15, minute: 30, desc: '3:30 PM' },
    { label: 'Maghrib', icon: 'moon-outline' as const, key: 'Maghrib', hour: 18, minute: 15, desc: '6:15 PM' },
    { label: 'Isha', icon: 'moon-outline' as const, key: 'Isha', hour: 21, minute: 0, desc: '9:00 PM' },
];

export default function SettingsScreen() {
    const theme = useTheme();
    const router = useRouter();
    const { settings, updateSettings } = useSettings();

    const { isPro, restorePurchases: restoreProPurchases } = usePro();
    const { user, logout, deleteAccount, deleteAccountWithPassword } = useAuth();
    const [reciterPickerVisible, setReciterPickerVisible] = useState(false);
    const [translationPickerExpanded, setTranslationPickerExpanded] = useState(false);
    const [fontPickerExpanded, setFontPickerExpanded] = useState(false);
    const [restoringPurchases, setRestoringPurchases] = useState(false);

    // Derived translation data
    const currentEdition = getEditionById(settings.translationEdition);
    const availableLanguages = getAvailableLanguages();

    // Notification state
    const [reminderEnabled, setReminderEnabled] = useState(settings.dailyReminderEnabled);
    const [timePickerExpanded, setTimePickerExpanded] = useState(false);
    const [selectedChip, setSelectedChip] = useState<string>(() => {
        const h = settings.reminderHour;
        const m = settings.reminderMinute;
        const match = PRAYER_TIMES.find(p => p.hour === h && p.minute === m);
        return match ? match.key : 'Custom';
    });
    const [reminderTime, setReminderTime] = useState(() => {
        const d = new Date();
        d.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
        return d;
    });

    // Sync state with settings on load
    useEffect(() => {
        setReminderEnabled(settings.dailyReminderEnabled);
        const d = new Date();
        d.setHours(settings.reminderHour, settings.reminderMinute, 0, 0);
        setReminderTime(d);
    }, [settings.dailyReminderEnabled, settings.reminderHour, settings.reminderMinute]);

    const handleReminderToggle = async (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setReminderEnabled(value);

        if (value) {
            const granted = await NotificationService.requestPermissions();
            if (granted) {
                const hour = reminderTime.getHours();
                const minute = reminderTime.getMinutes();
                await updateSettings({ dailyReminderEnabled: true, reminderHour: hour, reminderMinute: minute });
            } else {
                setReminderEnabled(false);
                Alert.alert('Permissions Required', 'Please enable notifications in your device settings.');
            }
        } else {
            await NotificationService.cancelAllReminders();
            await updateSettings({ dailyReminderEnabled: false });
        }
    };



    const handleReminderTimeChange = async (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
            setReminderTime(selectedDate);
            setSelectedChip('Custom');
            const hour = selectedDate.getHours();
            const minute = selectedDate.getMinutes();
            await updateSettings({ reminderHour: hour, reminderMinute: minute });
        }
    };

    const handleSignOut = async () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign Out',
                style: 'destructive',
                onPress: async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    await logout();
                    // Navigate directly to login screen
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    const handleDeleteAccount = () => {
        Alert.alert(
            'Delete Account',
            'Are you sure you want to delete your account? This will permanently delete all your notes, recordings, folders, and data. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Everything',
                    style: 'destructive',
                    onPress: () => {
                        Alert.alert(
                            'Final Confirmation',
                            'This is your last chance. All your data will be permanently deleted and cannot be recovered.',
                            [
                                { text: 'Keep My Account', style: 'cancel' },
                                {
                                    text: 'Delete Forever',
                                    style: 'destructive',
                                    onPress: async () => {
                                        try {
                                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                            await deleteAccount();
                                            router.replace('/(auth)/sign-up');
                                        } catch (error: any) {
                                            if (error.code === 'auth/needs-password') {
                                                // Email/password user — prompt for password
                                                promptForPasswordAndDelete();
                                            } else if (error.code === 'auth/invalid-login-credentials' || error.code === 'auth/requires-recent-login') {
                                                // Session expired — just sign out and redirect
                                                await logout();
                                                router.replace('/(auth)/sign-up');
                                                Alert.alert('Account Removed', 'Your session had expired. You have been signed out.');
                                            } else {
                                                Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
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

    /** Prompt email/password users for their password to re-authenticate before deletion. */
    const promptForPasswordAndDelete = () => {
        Alert.prompt(
            'Verify Your Identity',
            'Please enter your password to confirm account deletion.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Account',
                    style: 'destructive',
                    onPress: async (password?: string) => {
                        if (!password || password.length === 0) {
                            Alert.alert('Error', 'Password is required.');
                            return;
                        }
                        try {
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                            await deleteAccountWithPassword(password);
                            router.replace('/(auth)/sign-up');
                        } catch (error: any) {
                            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                                Alert.alert('Incorrect Password', 'The password you entered is incorrect. Please try again.', [
                                    { text: 'OK', onPress: () => promptForPasswordAndDelete() },
                                ]);
                            } else {
                                Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
                            }
                        }
                    },
                },
            ],
            'secure-text'
        );
    };

    const handleManageSubscription = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Apple's deep link to subscription management
        const url = 'https://apps.apple.com/account/subscriptions';
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
            await Linking.openURL(url);
        } else {
            Alert.alert(
                'Manage Subscription',
                'To manage your subscription, go to Settings → Apple ID → Subscriptions on your device.'
            );
        }
    };

    const handleRestorePurchases = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setRestoringPurchases(true);
        try {
            const success = await restoreProPurchases();
            if (success) {
                Alert.alert('Restored', 'Your purchases have been restored successfully.');
            } else {
                Alert.alert('No Purchases Found', 'No previous purchases were found for this account.');
            }
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not restore purchases. Please try again.');
        } finally {
            setRestoringPurchases(false);
        }
    };

    const toggleDarkMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        updateSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' });
    };

    const handleReciterSelect = (reciterId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        updateSettings({ reciterId });
    };



    return (
        <LinearGradient
            colors={theme.dark ? ['#0F1419', '#1A1F26'] : (Gradients.sereneSky as any)}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={[styles.headerTitle, { color: theme.colors.primary }]}>
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

                                {/* Manage Subscription — only visible for Pro users */}
                                {isPro && (
                                    <Pressable
                                        style={({ pressed }) => [
                                            styles.card,
                                            { backgroundColor: theme.colors.surface, marginBottom: Spacing.sm },
                                            Shadows.sm,
                                            pressed && styles.cardPressed,
                                        ]}
                                        onPress={handleManageSubscription}>
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { backgroundColor: theme.colors.primaryContainer },
                                            ]}>
                                            <Ionicons name="card" size={18} color={theme.colors.primary} />
                                        </View>
                                        <View style={styles.cardContent}>
                                            <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                                Manage Subscription
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.cardSubtitle,
                                                    { color: theme.colors.onSurfaceVariant },
                                                ]}>
                                                Cancel or change your plan
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name="open-outline"
                                            size={18}
                                            color={theme.colors.onSurfaceVariant}
                                        />
                                    </Pressable>
                                )}

                                {/* Restore Purchases */}
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.card,
                                        { backgroundColor: theme.colors.surface, marginBottom: Spacing.sm },
                                        Shadows.sm,
                                        pressed && styles.cardPressed,
                                        restoringPurchases && { opacity: 0.6 },
                                    ]}
                                    onPress={handleRestorePurchases}
                                    disabled={restoringPurchases}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme.colors.secondaryContainer },
                                        ]}>
                                        <Ionicons name="refresh" size={18} color={theme.colors.secondary} />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                            {restoringPurchases ? 'Restoring...' : 'Restore Purchases'}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.cardSubtitle,
                                                { color: theme.colors.onSurfaceVariant },
                                            ]}>
                                            Recover previous subscriptions
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

                    {/* ═══ QURAN & AUDIO ═══ */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            QURAN & AUDIO
                        </Text>
                        <View style={[styles.groupedCard, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                            {/* Reciter */}
                            <Pressable
                                style={({ pressed }) => [styles.groupedRow, pressed && styles.cardPressed]}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setReciterPickerVisible(true); }}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                                    <Ionicons name="musical-notes" size={18} color={theme.colors.primary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Reciter</Text>
                                    <Text style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>{getReciterById(settings.reciterId).name}</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={20} color={theme.colors.onSurfaceVariant} />
                            </Pressable>

                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* Translation Language */}
                            <Pressable
                                style={({ pressed }) => [styles.groupedRow, pressed && styles.cardPressed]}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setTranslationPickerExpanded(!translationPickerExpanded); }}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                                    <Ionicons name="globe-outline" size={18} color={theme.colors.primary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Translation</Text>
                                    <Text style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>{currentEdition ? `${currentEdition.flag} ${currentEdition.languageName}` : 'English'}</Text>
                                </View>
                                <Ionicons name={translationPickerExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
                            </Pressable>
                            {translationPickerExpanded && (
                                <View style={styles.expandedContent}>
                                    <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />
                                    {availableLanguages.map((lang) => (
                                        <View key={lang.language}>
                                            {lang.editions.map((edition) => {
                                                const isActive = settings.translationEdition === edition.identifier;
                                                return (
                                                    <Pressable key={edition.identifier} style={({ pressed }) => [styles.prayerRow, isActive && { backgroundColor: theme.colors.primaryContainer }, pressed && { opacity: 0.7 }]}
                                                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ translationEdition: edition.identifier }); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setTranslationPickerExpanded(false); }}>
                                                        <Ionicons name="globe-outline" size={20} color={theme.colors.onSurfaceVariant} style={{ marginRight: Spacing.sm }} />
                                                        <Text style={[styles.prayerLabel, { color: theme.colors.onSurface }]}>{edition.languageName}</Text>
                                                        <Text style={[styles.prayerTime, { color: theme.colors.onSurfaceVariant }]}>{edition.name}</Text>
                                                        {isActive && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={{ marginLeft: Spacing.xs }} />}
                                                    </Pressable>
                                                );
                                            })}
                                        </View>
                                    ))}
                                </View>
                            )}

                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* Arabic Font */}
                            <Pressable
                                style={({ pressed }) => [styles.groupedRow, pressed && styles.cardPressed]}
                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFontPickerExpanded(!fontPickerExpanded); }}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.tertiaryContainer }]}>
                                    <Ionicons name="text-outline" size={18} color={theme.colors.tertiary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Arabic Font</Text>
                                    <Text style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>{getQuranFontOption(settings.quranFont).name}</Text>
                                </View>
                                <Ionicons name={fontPickerExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
                            </Pressable>
                            {fontPickerExpanded && (
                                <View style={styles.expandedContent}>
                                    <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />
                                    {QURAN_FONT_OPTIONS.map((font) => {
                                        const isActive = settings.quranFont === font.id;
                                        return (
                                            <Pressable key={font.id} style={({ pressed }) => [styles.prayerRow, isActive && { backgroundColor: theme.colors.primaryContainer }, pressed && { opacity: 0.7 }]}
                                                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ quranFont: font.id as QuranFontId }); LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setFontPickerExpanded(false); }}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[styles.prayerLabel, { color: theme.colors.onSurface }]}>{font.name}</Text>
                                                    <Text style={{ fontSize: 11, color: theme.colors.onSurfaceVariant }}>{font.description}</Text>
                                                </View>
                                                <Text style={{ fontFamily: font.fontFamily, fontSize: 18, color: theme.colors.onSurface, writingDirection: 'rtl' }}>بِسْمِ ٱللَّهِ</Text>
                                                {isActive && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} style={{ marginLeft: Spacing.xs }} />}
                                            </Pressable>
                                        );
                                    })}
                                </View>
                            )}

                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* Transliteration */}
                            <View style={styles.groupedRow}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
                                    <Ionicons name="text-outline" size={18} color={theme.colors.secondary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Transliteration</Text>
                                </View>
                                <RNSwitch value={settings.showTransliteration} onValueChange={(value) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); updateSettings({ showTransliteration: value }); }} trackColor={{ false: '#48484A', true: theme.colors.primary }} thumbColor={settings.showTransliteration ? '#FFF' : '#F4F4F4'} />
                            </View>

                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* Dark Mode */}
                            <View style={styles.groupedRow}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                                    <Ionicons name="moon" size={18} color={theme.colors.primary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Dark Mode</Text>
                                </View>
                                <RNSwitch value={settings.theme === 'dark'} onValueChange={toggleDarkMode} trackColor={{ false: '#48484A', true: theme.colors.primary }} thumbColor={settings.theme === 'dark' ? '#FFF' : '#F4F4F4'} />
                            </View>
                        </View>
                    </View>
                    {/* Notifications Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            NOTIFICATIONS
                        </Text>

                        {/* Unified Notifications Card */}
                        <View
                            style={[
                                styles.card,
                                {
                                    backgroundColor: theme.colors.surface,
                                    flexDirection: 'column',
                                    alignItems: 'stretch',
                                    paddingVertical: 0,
                                    paddingHorizontal: 0,
                                    overflow: 'hidden',
                                },
                                Shadows.sm,
                            ]}>

                            {/* ── Row 1: Daily Quran Reminder ── */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: Spacing.md,
                                paddingVertical: 14,
                            }}>
                                <View
                                    style={[
                                        styles.iconContainer,
                                        { backgroundColor: theme.colors.primaryContainer },
                                    ]}>
                                    <Ionicons
                                        name="book"
                                        size={16}
                                        color={theme.colors.primary}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 0 }}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                        Daily Quran Reminder
                                    </Text>
                                    <Text
                                        style={[
                                            styles.cardSubtitle,
                                            { color: theme.colors.onSurfaceVariant },
                                        ]}>
                                        {reminderEnabled
                                            ? selectedChip === 'Custom'
                                                ? `Custom · ${reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                                                : `${selectedChip} · ${PRAYER_TIMES.find(p => p.key === selectedChip)?.desc || ''}`
                                            : 'Personalized reading reminders'}
                                    </Text>
                                </View>
                                <RNSwitch
                                    value={reminderEnabled}
                                    onValueChange={handleReminderToggle}
                                    trackColor={{ false: '#48484A', true: theme.colors.primary }}
                                    thumbColor={reminderEnabled ? '#FFF' : '#F4F4F4'}
                                />
                            </View>

                            {/* Expandable time picker — inside the same card */}
                            {reminderEnabled && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />
                                    <Pressable
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 12 }}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setTimePickerExpanded(!timePickerExpanded);
                                        }}>
                                        <Ionicons
                                            name="time-outline"
                                            size={18}
                                            color={theme.colors.onSurfaceVariant}
                                            style={{ marginRight: Spacing.sm }}
                                        />
                                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface, flex: 1, fontSize: 14 }]}>
                                            Reminder Time
                                        </Text>
                                        <Ionicons
                                            name={timePickerExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={18}
                                            color={theme.colors.onSurfaceVariant}
                                        />
                                    </Pressable>

                                    {timePickerExpanded && (
                                        <View style={{ paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm }}>
                                            {PRAYER_TIMES.map((time) => {
                                                const isActive = selectedChip === time.key;
                                                return (
                                                    <Pressable
                                                        key={time.key}
                                                        style={({ pressed }) => [
                                                            styles.prayerRow,
                                                            isActive && { backgroundColor: theme.colors.primaryContainer },
                                                            pressed && { opacity: 0.7 },
                                                        ]}
                                                        onPress={async () => {
                                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                            setSelectedChip(time.key);
                                                            const d = new Date();
                                                            d.setHours(time.hour, time.minute, 0, 0);
                                                            setReminderTime(d);
                                                            await updateSettings({ reminderHour: time.hour, reminderMinute: time.minute });
                                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                            setTimePickerExpanded(false);
                                                        }}>
                                                        <Ionicons name={time.icon} size={20} color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant} style={{ marginRight: Spacing.sm }} />
                                                        <Text style={[styles.prayerLabel, { color: theme.colors.onSurface }]}>
                                                            {time.label}
                                                        </Text>
                                                        <Text style={[styles.prayerTime, { color: theme.colors.onSurfaceVariant }]}>
                                                            {time.desc}
                                                        </Text>
                                                        {isActive && (
                                                            <Ionicons
                                                                name="checkmark-circle"
                                                                size={20}
                                                                color={theme.colors.primary}
                                                                style={{ marginLeft: Spacing.xs }}
                                                            />
                                                        )}
                                                    </Pressable>
                                                );
                                            })}

                                            {/* Custom time option */}
                                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />
                                            <View style={styles.customTimeRow}>
                                                <Ionicons name="time-outline" size={20} color={selectedChip === 'Custom' ? theme.colors.primary : theme.colors.onSurfaceVariant} style={{ marginRight: Spacing.sm }} />
                                                <Text style={[styles.prayerLabel, {
                                                    color: selectedChip === 'Custom' ? theme.colors.primary : theme.colors.onSurface,
                                                    fontWeight: selectedChip === 'Custom' ? '700' : '500',
                                                }]}>
                                                    Custom Time
                                                </Text>
                                                <DateTimePicker
                                                    value={reminderTime}
                                                    mode="time"
                                                    is24Hour={false}
                                                    onChange={handleReminderTimeChange}
                                                    display="default"
                                                    themeVariant={theme.dark ? 'dark' : 'light'}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </>
                            )}

                            {/* ── Divider between rows ── */}
                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* ── Row 2: Adhkar Reminders ── */}
                            <View style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingHorizontal: Spacing.md,
                                paddingVertical: 14,
                            }}>
                                <View
                                    style={[
                                        styles.iconContainer,
                                        { backgroundColor: theme.colors.tertiaryContainer || theme.colors.primaryContainer },
                                    ]}>
                                    <Ionicons
                                        name="sparkles"
                                        size={16}
                                        color={theme.colors.tertiary || theme.colors.primary}
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 0 }}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                        Adhkar Reminders
                                    </Text>
                                    <Text
                                        style={[
                                            styles.cardSubtitle,
                                            { color: theme.colors.onSurfaceVariant },
                                        ]}>
                                        Morning, evening & night
                                    </Text>
                                </View>
                                <RNSwitch
                                    value={settings.adhkarReminderEnabled}
                                    onValueChange={async (value) => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        if (value) {
                                            const granted = await NotificationService.requestPermissions();
                                            if (!granted) {
                                                Alert.alert('Permissions Required', 'Please enable notifications in your device settings.');
                                                return;
                                            }
                                        }
                                        await updateSettings({ adhkarReminderEnabled: value });
                                    }}
                                    trackColor={{ false: '#48484A', true: theme.colors.primary }}
                                    thumbColor={settings.adhkarReminderEnabled ? '#FFF' : '#F4F4F4'}
                                />
                            </View>
                        </View>
                    </View>

                    {/* ═══ SUPPORT & LEGAL ═══ */}
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            SUPPORT & LEGAL
                        </Text>
                        <View style={[styles.groupedCard, { backgroundColor: theme.colors.surface }, Shadows.sm]}>
                            {/* Version */}
                            <View style={styles.groupedRow}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
                                    <Ionicons name="information" size={18} color={theme.colors.secondary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Version</Text>
                                    <Text style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>2.0.0</Text>
                                </View>
                            </View>

                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* Privacy Policy */}
                            <Pressable
                                style={({ pressed }) => [styles.groupedRow, pressed && styles.cardPressed]}
                                onPress={() => Linking.openURL('https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/privacy.html')}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.primaryContainer }]}>
                                    <Ionicons name="shield-checkmark" size={18} color={theme.colors.primary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Privacy Policy</Text>
                                </View>
                                <Ionicons name="open-outline" size={18} color={theme.colors.onSurfaceVariant} />
                            </Pressable>

                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />

                            {/* Terms of Use */}
                            <Pressable
                                style={({ pressed }) => [styles.groupedRow, pressed && styles.cardPressed]}
                                onPress={() => Linking.openURL('https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/terms.html')}>
                                <View style={[styles.iconContainer, { backgroundColor: theme.colors.secondaryContainer }]}>
                                    <Ionicons name="document-text" size={18} color={theme.colors.secondary} />
                                </View>
                                <View style={styles.cardContent}>
                                    <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>Terms of Use</Text>
                                </View>
                                <Ionicons name="open-outline" size={18} color={theme.colors.onSurfaceVariant} />
                            </Pressable>

                            {/* Delete Account (destructive, at bottom) */}
                            {user && (
                                <>
                                    <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant, marginHorizontal: Spacing.md }]} />
                                    <Pressable
                                        style={({ pressed }) => [styles.groupedRow, pressed && styles.cardPressed]}
                                        onPress={handleDeleteAccount}>
                                        <View style={[styles.iconContainer, { backgroundColor: theme.colors.errorContainer || '#FFEBEE' }]}>
                                            <Ionicons name="trash" size={18} color={theme.colors.error} />
                                        </View>
                                        <View style={styles.cardContent}>
                                            <Text style={[styles.cardTitle, { color: theme.colors.error }]}>Delete Account</Text>
                                            <Text style={[styles.cardSubtitle, { color: theme.colors.onSurfaceVariant }]}>Permanently delete all data</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={20} color={theme.colors.error} />
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </View>



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
        paddingBottom: 100,
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
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    timeChip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    chipLabel: {
        fontSize: 13,
        fontWeight: '600',
    },
    // Expandable card styles
    groupedCard: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    groupedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 14,
    },
    expandableCard: {
        borderRadius: BorderRadius.lg,
        overflow: 'hidden',
    },
    expandableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.md,
    },
    expandedContent: {
        paddingBottom: Spacing.xs,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
        marginHorizontal: Spacing.md,
        marginVertical: Spacing.xs,
    },
    prayerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.sm + 2,
        paddingHorizontal: Spacing.md,
        marginHorizontal: Spacing.sm,
        borderRadius: BorderRadius.md,
    },

    prayerLabel: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
        marginLeft: Spacing.sm,
    },
    prayerTime: {
        fontSize: 13,
        fontWeight: '400',
    },
    customTimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: Spacing.xs,
        paddingHorizontal: Spacing.md,
        marginHorizontal: Spacing.sm,
    },
});
