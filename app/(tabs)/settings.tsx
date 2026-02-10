import { View, StyleSheet, ScrollView, Pressable, Alert, Switch as RNSwitch } from 'react-native';
import { Text, useTheme, Switch } from 'react-native-paper';
import { useState, useEffect } from 'react';
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

export default function SettingsScreen() {
    const theme = useTheme();
    const router = require('expo-router').useRouter();
    const { settings, updateSettings, resetSettings } = useSettings();

    const { toggleDebugPro, isPro } = usePro();
    const { user, loading, logout } = useAuth();
    const [reciterPickerVisible, setReciterPickerVisible] = useState(false);

    // Notification state
    const [reminderEnabled, setReminderEnabled] = useState(settings.dailyReminderEnabled);
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

                        {/* Time Picker — only when enabled */}
                        {reminderEnabled && (
                            <>
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
                                            name="time-outline"
                                            size={18}
                                            color={theme.colors.primary}
                                        />
                                    </View>
                                    <View style={styles.cardContent}>
                                        <Text style={[styles.cardTitle, { color: theme.colors.onSurface }]}>
                                            Reminder Time
                                        </Text>
                                    </View>
                                    <DateTimePicker
                                        value={reminderTime}
                                        mode="time"
                                        is24Hour={false}
                                        onChange={handleReminderTimeChange}
                                        display="default"
                                        themeVariant={theme.dark ? 'dark' : 'light'}
                                    />
                                </View>

                                {/* Quick Prayer Time Chips */}
                                <View style={styles.chipRow}>
                                    {[
                                        { label: '🌅 Fajr', hour: 5, minute: 30 },
                                        { label: '☀️ Dhuhr', hour: 13, minute: 0 },
                                        { label: '🌙 Isha', hour: 21, minute: 0 },
                                    ].map((time) => (
                                        <Pressable
                                            key={time.label}
                                            style={({ pressed }) => [
                                                styles.timeChip,
                                                { backgroundColor: theme.colors.primaryContainer },
                                                pressed && { opacity: 0.7 },
                                            ]}
                                            onPress={async () => {
                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                const d = new Date();
                                                d.setHours(time.hour, time.minute, 0, 0);
                                                setReminderTime(d);
                                                if (reminderEnabled) {
                                                    await NotificationService.scheduleDailyReminder(time.hour, time.minute);
                                                }
                                                await updateSettings({ reminderHour: time.hour, reminderMinute: time.minute });
                                            }}>
                                            <Text style={[styles.chipLabel, { color: theme.colors.primary }]}>
                                                {time.label}
                                            </Text>
                                        </Pressable>
                                    ))}
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
    chipRow: {
        flexDirection: 'row',
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
});
