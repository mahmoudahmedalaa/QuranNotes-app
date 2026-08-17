import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CloudSyncEvents } from '../../../core/application/services/CloudSyncEvents';
import { MD3LightTheme, MD3DarkTheme, Provider as PaperProvider } from 'react-native-paper';
import { View, Text, Button } from 'react-native';

import { DEFAULT_RECITER } from '../../audio-player/domain/Reciter';
import type { QuranFontId } from '../../../core/theme/QuranFonts';

interface AppSettings {
    fontSize: number;
    isDarkMode: boolean;
    theme: 'light' | 'dark';
    lastReadSurah?: number;
    reciterId: string;
    translationEdition: string;
    showTransliteration: boolean;
    dailyReminderEnabled: boolean;
    reminderHour: number;
    reminderMinute: number;
    streakReminderEnabled: boolean;
    khatmaReminderEnabled: boolean;
    prayerMethod?: number;    // undefined = auto-detect from location
    prayerLocation: string;
    adhkarReminderEnabled: boolean;
    hadithNotificationsEnabled: boolean;
    quranFont: QuranFontId;
}

const DEFAULT_SETTINGS: AppSettings = {
    fontSize: 20,
    isDarkMode: false,
    theme: 'light',
    reciterId: DEFAULT_RECITER.id,
    translationEdition: 'en.sahih',
    showTransliteration: false,
    dailyReminderEnabled: false,
    reminderHour: 12,
    reminderMinute: 30,
    streakReminderEnabled: false,
    khatmaReminderEnabled: false,
    prayerMethod: undefined,  // auto-detect from location
    prayerLocation: '',
    adhkarReminderEnabled: false,
    hadithNotificationsEnabled: false,
    quranFont: 'kfgqpc' as QuranFontId,
};

const STORAGE_KEY = 'app_settings';

interface SettingsContextType {
    settings: AppSettings;
    updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
    resetSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
    settings: DEFAULT_SETTINGS,
    updateSettings: async () => { },
    resetSettings: async () => { },
});

export const useSettings = () => useContext(SettingsContext);

class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
> {
    state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    reset = async () => {
        try {
            await AsyncStorage.clear();
            alert('Data cleared. Please restart the app completely.');
        } catch (e) {
            alert('Failed to clear data: ' + e);
        }
    };

    render() {
        if (this.state.hasError) {
            return (
                <View
                    style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: 20,
                        backgroundColor: 'white',
                    }}>
                    <Text
                        style={{
                            fontSize: 18,
                            marginBottom: 10,
                            color: 'red',
                            fontWeight: 'bold',
                        }}>
                        App Crashed
                    </Text>
                    <Text style={{ marginBottom: 20, textAlign: 'center' }}>
                        {this.state.error?.toString()}
                    </Text>
                    <Button title="Factory Reset (Clear Data)" onPress={this.reset} color="red" />
                </View>
            );
        }
        return this.props.children;
    }
}

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [, setIsReady] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    // Re-read settings when cloud sync pulls remote data
    useEffect(() => {
        return CloudSyncEvents.onPull(() => { loadSettings(); });
    }, []);

    const loadSettings = async () => {
        try {
            const data = await AsyncStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);

                // Aggressive sanitization
                const loaded: AppSettings = {
                    fontSize: parsed.fontSize || DEFAULT_SETTINGS.fontSize,
                    isDarkMode: parsed.isDarkMode ?? DEFAULT_SETTINGS.isDarkMode,
                    theme: parsed.theme || DEFAULT_SETTINGS.theme,
                    lastReadSurah: parsed.lastReadSurah,
                    reciterId: parsed.reciterId || DEFAULT_SETTINGS.reciterId,
                    translationEdition: parsed.translationEdition || DEFAULT_SETTINGS.translationEdition,
                    showTransliteration: parsed.showTransliteration ?? DEFAULT_SETTINGS.showTransliteration,
                    dailyReminderEnabled: parsed.dailyReminderEnabled ?? DEFAULT_SETTINGS.dailyReminderEnabled,
                    reminderHour: parsed.reminderHour ?? DEFAULT_SETTINGS.reminderHour,
                    reminderMinute: parsed.reminderMinute ?? DEFAULT_SETTINGS.reminderMinute,
                    streakReminderEnabled: parsed.streakReminderEnabled ?? false,
                    khatmaReminderEnabled: parsed.khatmaReminderEnabled ?? false,
                    // Migrate: old default was 4 (Umm Al-Qura). Treat as undefined (auto-detect)
                    // unless the user explicitly chose a different method.
                    prayerMethod: parsed.prayerMethod === 4 ? undefined : parsed.prayerMethod,
                    prayerLocation: parsed.prayerLocation ?? DEFAULT_SETTINGS.prayerLocation,
                    adhkarReminderEnabled: parsed.adhkarReminderEnabled ?? false,
                    hadithNotificationsEnabled: parsed.hadithNotificationsEnabled ?? false,
                    quranFont: parsed.quranFont ?? DEFAULT_SETTINGS.quranFont,
                };

                setSettings({ ...DEFAULT_SETTINGS, ...loaded });
            }
        } catch (e) {
            if (__DEV__) console.error('Failed to load settings', e);
            await AsyncStorage.removeItem(STORAGE_KEY); // Corrupt? Kill it.
        } finally {
            setIsReady(true);
        }
    };

    const updateSettings = async (newSettings: Partial<AppSettings>) => {
        try {
            const updated = { ...settings, ...newSettings };
            setSettings(updated);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            if (__DEV__) console.error('Failed to save settings', e);
        }
    };

    const resetSettings = async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setSettings(DEFAULT_SETTINGS);
        } catch (e) {
            if (__DEV__) console.error('Failed to reset settings', e);
        }
    };

    // if (!isReady) return null; // Don't block render. Allow async update.

    // Theme is derived in PaperProvider below

    return (
        <ErrorBoundary>
            <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
                <PaperProvider theme={settings.theme === 'dark' ? MD3DarkTheme : MD3LightTheme}>
                    {children}
                </PaperProvider>
            </SettingsContext.Provider>
        </ErrorBoundary>
    );
};
