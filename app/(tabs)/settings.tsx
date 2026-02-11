import { View, StyleSheet, ScrollView, Pressable, Alert, Switch as RNSwitch, Animated, LayoutAnimation, Platform, UIManager, Linking } from 'react-native';
import { Text, useTheme, Switch } from 'react-native-paper';
import { useState, useEffect, useRef } from 'react';
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PRAYER_TIMES = [
    { label: 'Fajr', emoji: '🌅', key: 'Fajr', hour: 5, minute: 30, desc: '5:30 AM' },
    { label: 'Dhuhr', emoji: '☀️', key: 'Dhuhr', hour: 12, minute: 30, desc: '12:30 PM' },
    { label: 'Asr', emoji: '🌤️', key: 'Asr', hour: 15, minute: 30, desc: '3:30 PM' },
    { label: 'Maghrib', emoji: '🌇', key: 'Maghrib', hour: 18, minute: 15, desc: '6:15 PM' },
    { label: 'Isha', emoji: '🌙', key: 'Isha', hour: 21, minute: 0, desc: '9:00 PM' },
];

export default function SettingsScreen() {
    const theme = useTheme();
    const router = require('expo-router').useRouter();
    const { settings, updateSettings, resetSettings } = useSettings();

    const { toggleDebugPro, isPro } = usePro();
    const { user, loading, logout, deleteAccount } = useAuth();
    const [reciterPickerVisible, setReciterPickerVisible] = useState(false);

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
                await NotificationService.scheduleDailyReminder(hour, minute);
                await updateSettings({ dailyReminderEnabled: true, reminderHour: hour, reminderMinute: minute });
            } else {
                setReminderEnabled(false);
                Alert.alert('Permissions Required', 'Please enable notifications in your device settings.');
            }
        } else {
            await NotificationService.cancelDailyReminder();
            await updateSettings({ dailyReminderEnabled: false });
        }
    };

    const handleReminderTimeChange = async (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
            setReminderTime(selectedDate);
            setSelectedChip('Custom');
            const hour = selectedDate.getHours();
            const minute = selectedDate.getMinutes();
            if (reminderEnabled) {
                await NotificationService.scheduleDailyReminder(hour, minute);
            }
            await updateSettings({ reminderHour: hour, reminderMinute: minute });
        }
    };

    const handleTestNotification = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const granted = await NotificationService.requestPermissions();
        if (granted) {
            await NotificationService.sendTestNotification();
            Alert.alert('Sent! 🔔', 'A preview notification will appear in ~3 seconds.');
        } else {
            Alert.alert('Permissions Required', 'Please enable notifications in your device settings.');
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
                    Alert.alert('Signed Out', 'You have been signed out.');
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
                                            Alert.alert('Account Deleted', 'Your account and all data have been permanently deleted.');
                                        } catch (error: any) {
                                            Alert.alert('Error', error.message || 'Failed to delete account. Please try again.');
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

                    {/* Notifications Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            NOTIFICATIONS
                        </Text>

                        {/* Reminder Toggle Card */}
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
                                    name="notifications"
                                    size={18}
                                    color={theme.colors.primary}
                                />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Daily Reminders
                                </Text>
                                <Text
                                    style={[
                                        styles.cardSubtitle,
                                        { color: theme.colors.onSurfaceVariant },
                                    ]}>
                                    Get notified to read Quran daily
                                </Text>
                            </View>
                            <RNSwitch
                                value={reminderEnabled}
                                onValueChange={handleReminderToggle}
                                trackColor={{ false: '#48484A', true: theme.colors.primary }}
                                thumbColor={reminderEnabled ? '#FFF' : '#F4F4F4'}
                            />
                        </View>

                        {/* Reminder Time — expandable card */}
                        {reminderEnabled && (
                            <>
                                <View
                                    style={[
                                        styles.expandableCard,
                                        { backgroundColor: theme.colors.surface, marginBottom: Spacing.sm },
                                        Shadows.sm,
                                    ]}>
                                    {/* Header row — tappable */}
                                    <Pressable
                                        style={styles.expandableHeader}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                            setTimePickerExpanded(!timePickerExpanded);
                                        }}>
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { backgroundColor: theme.colors.primaryContainer },
                                            ]}>
                                            <Ionicons
                                                name="time-outline"
                                                size={18}
                                                color={theme.colors.primary}
                                            />
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
                                                {selectedChip === 'Custom'
                                                    ? `Custom · ${reminderTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                                                    : `${PRAYER_TIMES.find(p => p.key === selectedChip)?.emoji || '🕌'} ${selectedChip} · ${PRAYER_TIMES.find(p => p.key === selectedChip)?.desc || ''}`}
                                            </Text>
                                        </View>
                                        <Ionicons
                                            name={timePickerExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={20}
                                            color={theme.colors.onSurfaceVariant}
                                        />
                                    </Pressable>

                                    {/* Expanded options */}
                                    {timePickerExpanded && (
                                        <View style={styles.expandedContent}>
                                            <View style={[styles.divider, { backgroundColor: theme.colors.surfaceVariant }]} />

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
                                                            if (reminderEnabled) {
                                                                await NotificationService.scheduleDailyReminder(time.hour, time.minute);
                                                            }
                                                            await updateSettings({ reminderHour: time.hour, reminderMinute: time.minute });
                                                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                            setTimePickerExpanded(false);
                                                        }}>
                                                        <Text style={styles.prayerEmoji}>{time.emoji}</Text>
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
                                                <Text style={styles.prayerEmoji}>⏰</Text>
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
                                </View>

                                {/* Preview Notification */}
                                <Pressable
                                    style={({ pressed }) => [
                                        styles.card,
                                        { backgroundColor: theme.colors.surface },
                                        Shadows.sm,
                                        pressed && styles.cardPressed,
                                    ]}
                                    onPress={handleTestNotification}>
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: theme.colors.secondaryContainer },
                                        ]}>
                                        <Ionicons
                                            name="send"
                                            size={18}
                                            color={theme.colors.secondary}
                                        />
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
                                            Send a test in 3 seconds
                                        </Text>
                                    </View>
                                    <Ionicons
                                        name="chevron-forward"
                                        size={20}
                                        color={theme.colors.onSurfaceVariant}
                                    />
                                </Pressable>
                            </>
                        )}
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
                                color={theme.colors.primary}
                            />
                        </View>
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
                                    2.0.0
                                </Text>
                            </View>
                        </View>
                    </View>

                    {/* Legal Section */}
                    <View style={styles.section}>
                        <Text
                            style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                            LEGAL
                        </Text>
                        <Pressable
                            style={({ pressed }) => [
                                styles.card,
                                { backgroundColor: theme.colors.surface, marginBottom: Spacing.sm },
                                Shadows.sm,
                                pressed && styles.cardPressed,
                            ]}
                            onPress={() => Linking.openURL('https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/privacy.html')}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: theme.colors.primaryContainer },
                                ]}>
                                <Ionicons name="shield-checkmark" size={18} color={theme.colors.primary} />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Privacy Policy
                                </Text>
                            </View>
                            <Ionicons
                                name="open-outline"
                                size={18}
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
                            onPress={() => Linking.openURL('https://mahmoudahmedalaa.github.io/QuranNotes-app/legal/terms.html')}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    { backgroundColor: theme.colors.secondaryContainer },
                                ]}>
                                <Ionicons name="document-text" size={18} color={theme.colors.secondary} />
                            </View>
                            <View style={styles.cardContent}>
                                <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                    Terms of Use
                                </Text>
                            </View>
                            <Ionicons
                                name="open-outline"
                                size={18}
                                color={theme.colors.onSurfaceVariant}
                            />
                        </Pressable>
                    </View>

                    {/* Account Actions */}
                    {user && (
                        <View style={styles.section}>
                            <Text
                                style={[styles.sectionTitle, { color: theme.colors.onSurfaceVariant }]}>
                                ACCOUNT
                            </Text>
                            <Pressable
                                style={({ pressed }) => [
                                    styles.card,
                                    { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.error + '40' },
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
                                        Permanently delete all data
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color={theme.colors.error}
                                />
                            </Pressable>
                        </View>
                    )}

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
    prayerEmoji: {
        fontSize: 18,
        width: 28,
        textAlign: 'center',
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
