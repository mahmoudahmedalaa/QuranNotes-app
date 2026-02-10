import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Switch } from 'react-native';
import { Text, useTheme, Button } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOnboarding } from '../../src/infrastructure/onboarding/OnboardingContext';
import { useSettings } from '../../src/infrastructure/settings/SettingsContext';
import { NotificationService } from '../../src/infrastructure/notifications/NotificationService';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
    Spacing,
    BorderRadius,
    Shadows,
    Gradients,
} from '../../src/presentation/theme/DesignSystem';
import * as Haptics from 'expo-haptics';

export default function OnboardingReminders() {
    const theme = useTheme();
    const router = useRouter();
    const { goToStep } = useOnboarding();
    const { settings, updateSettings } = useSettings();

    const [enabled, setEnabled] = useState(true); // Opted-in by default
    const [pickerDate, setPickerDate] = useState(() => {
        const d = new Date();
        d.setHours(6, 0, 0, 0); // Default to 6:00 AM for Fajr
        return d;
    });

    const handleToggle = (value: boolean) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEnabled(value);
    };

    const handleTimeChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        if (selectedDate) {
            setPickerDate(selectedDate);
        }
    };

    const handleContinue = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const hour = pickerDate.getHours();
        const minute = pickerDate.getMinutes();

        if (enabled) {
            const granted = await NotificationService.requestPermissions();
            if (granted) {
                await NotificationService.scheduleDailyReminder(hour, minute);
                await updateSettings({
                    dailyReminderEnabled: true,
                    reminderHour: hour,
                    reminderMinute: minute,
                });
            }
        }

        goToStep(10);
        router.push('/onboarding/premium');
    };

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        goToStep(10);
        router.push('/onboarding/premium');
    };

    return (
        <LinearGradient
            colors={theme.dark ? (['#0F1419', '#1A1F26'] as const) : Gradients.sereneSky}
            style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                {/* Progress Indicator */}
                <View style={styles.progressContainer}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(step => (
                        <View
                            key={step}
                            style={[
                                styles.progressDot,
                                {
                                    backgroundColor:
                                        step <= 9
                                            ? theme.colors.primary
                                            : theme.colors.surfaceVariant,
                                },
                            ]}
                        />
                    ))}
                </View>

                {/* Header with Icon */}
                <MotiView
                    from={{ opacity: 0, translateY: -20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 400 }}
                    style={styles.header}>
                    <View
                        style={[
                            styles.iconCircle,
                            { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(91,127,255,0.1)' },
                        ]}>
                        <Ionicons name="notifications" size={40} color={theme.colors.primary} />
                    </View>
                    <Text style={[styles.title, { color: theme.colors.onBackground }]}>
                        Daily Quran Reminder
                    </Text>
                    <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>
                        A gentle nudge to keep your heart connected to Allah's words ✨
                    </Text>
                </MotiView>

                {/* Main Card */}
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 300 }}
                    style={styles.content}>
                    <View
                        style={[
                            styles.card,
                            { backgroundColor: theme.colors.surface },
                            Shadows.md,
                        ]}>
                        {/* Toggle Row */}
                        <View style={styles.toggleRow}>
                            <View style={styles.toggleInfo}>
                                <Text style={[styles.toggleTitle, { color: theme.colors.onSurface }]}>
                                    📿 Daily Reminders
                                </Text>
                                <Text style={[styles.toggleDesc, { color: theme.colors.onSurfaceVariant }]}>
                                    Get notified to read Quran daily
                                </Text>
                            </View>
                            <Switch
                                value={enabled}
                                onValueChange={handleToggle}
                                trackColor={{ false: '#48484A', true: theme.colors.primary }}
                                thumbColor={enabled ? '#FFF' : '#F4F4F4'}
                            />
                        </View>

                        {/* Time Picker — visible when enabled */}
                        {enabled && (
                            <MotiView
                                from={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ type: 'timing', duration: 300 }}
                            >
                                <View style={[styles.timeSeparator, { backgroundColor: theme.colors.outlineVariant }]} />

                                <View style={styles.timeSection}>
                                    <View style={styles.timeInfo}>
                                        <Ionicons name="time-outline" size={22} color={theme.colors.primary} />
                                        <Text style={[styles.timeLabel, { color: theme.colors.onSurface }]}>
                                            Reminder Time
                                        </Text>
                                    </View>

                                    <DateTimePicker
                                        value={pickerDate}
                                        mode="time"
                                        is24Hour={false}
                                        onChange={handleTimeChange}
                                        display="default"
                                        themeVariant={theme.dark ? 'dark' : 'light'}
                                    />
                                </View>

                                {/* Suggested times */}
                                <View style={styles.suggestedTimes}>
                                    <Text style={[styles.suggestedLabel, { color: theme.colors.onSurfaceVariant }]}>
                                        Popular prayer times:
                                    </Text>
                                    <View style={styles.timeChips}>
                                        {[
                                            { label: '🌅 Fajr', hour: 5, minute: 30 },
                                            { label: '☀️ After Dhuhr', hour: 13, minute: 0 },
                                            { label: '🌙 After Isha', hour: 21, minute: 0 },
                                        ].map((time) => (
                                            <Pressable
                                                key={time.label}
                                                style={({ pressed }) => [
                                                    styles.chip,
                                                    { backgroundColor: theme.colors.primaryContainer },
                                                    pressed && { opacity: 0.7 },
                                                ]}
                                                onPress={() => {
                                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                    const d = new Date();
                                                    d.setHours(time.hour, time.minute, 0, 0);
                                                    setPickerDate(d);
                                                }}
                                            >
                                                <Text style={[styles.chipText, { color: theme.colors.primary }]}>
                                                    {time.label}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            </MotiView>
                        )}
                    </View>
                </MotiView>

                {/* CTA Buttons */}
                <MotiView
                    from={{ opacity: 0, translateY: 20 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'spring', delay: 600 }}
                    style={styles.ctaContainer}>
                    <Button
                        mode="contained"
                        onPress={handleContinue}
                        style={styles.ctaButton}
                        labelStyle={styles.ctaLabel}
                        contentStyle={{ height: 54 }}>
                        {enabled ? 'Set Reminder & Continue' : 'Continue'}
                    </Button>
                    <Pressable onPress={handleSkip} style={styles.skipButton}>
                        <Text style={[styles.skipText, { color: theme.colors.onSurfaceVariant }]}>
                            Skip for now
                        </Text>
                    </Pressable>
                </MotiView>
            </SafeAreaView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
    },
    progressContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
        paddingTop: Spacing.md,
    },
    progressDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    header: {
        alignItems: 'center',
        paddingTop: Spacing.xxl,
        paddingBottom: Spacing.lg,
        paddingHorizontal: Spacing.xl,
    },
    iconCircle: {
        width: 96,
        height: 96,
        borderRadius: 48,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: Spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        opacity: 0.8,
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
    },
    card: {
        borderRadius: BorderRadius.xl,
        padding: Spacing.lg,
    },
    toggleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    toggleInfo: {
        flex: 1,
        marginRight: Spacing.md,
    },
    toggleTitle: {
        fontSize: 17,
        fontWeight: '600',
    },
    toggleDesc: {
        fontSize: 13,
        marginTop: 2,
    },
    timeSeparator: {
        height: StyleSheet.hairlineWidth,
        marginVertical: Spacing.md,
    },
    timeSection: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    timeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    timeLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
    suggestedTimes: {
        marginTop: Spacing.lg,
    },
    suggestedLabel: {
        fontSize: 12,
        fontWeight: '500',
        marginBottom: Spacing.sm,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timeChips: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    chip: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: BorderRadius.lg,
    },
    chipText: {
        fontSize: 13,
        fontWeight: '600',
    },
    ctaContainer: {
        paddingHorizontal: Spacing.xl,
        paddingBottom: Spacing.xl,
    },
    ctaButton: {
        borderRadius: BorderRadius.xl,
    },
    ctaLabel: {
        fontSize: 17,
        fontWeight: '700',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: Spacing.md,
    },
    skipText: {
        fontSize: 15,
        fontWeight: '500',
    },
});
