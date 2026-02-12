import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MD3LightTheme, MD3DarkTheme, Provider as PaperProvider } from 'react-native-paper';
import { View, Text, Button } from 'react-native';
import { PremiumTheme } from '../../presentation/theme/DesignSystem';
import { DEFAULT_RECITER } from '../../domain/entities/Reciter';

interface AppSettings {
    fontSize: number;
    isDarkMode: boolean;
    theme: 'light' | 'dark';
    lastReadSurah?: number;
    reciterId: string;
    dailyReminderEnabled: boolean;
    reminderHour: number;
    reminderMinute: number;
    debugSimulateRamadan: boolean;
    debugRamadanDay: number;
}

const DEFAULT_SETTINGS: AppSettings = {
    fontSize: 20,
    isDarkMode: false,
    theme: 'light',
    reciterId: DEFAULT_RECITER.id,
    dailyReminderEnabled: false,
    reminderHour: 6,
    reminderMinute: 0,
    debugSimulateRamadan: false,
    debugRamadanDay: 5,
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
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        loadSettings();
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
                    dailyReminderEnabled: parsed.dailyReminderEnabled ?? DEFAULT_SETTINGS.dailyReminderEnabled,
                    reminderHour: parsed.reminderHour ?? DEFAULT_SETTINGS.reminderHour,
                    reminderMinute: parsed.reminderMinute ?? DEFAULT_SETTINGS.reminderMinute,
                    debugSimulateRamadan: parsed.debugSimulateRamadan ?? DEFAULT_SETTINGS.debugSimulateRamadan,
                    debugRamadanDay: parsed.debugRamadanDay ?? DEFAULT_SETTINGS.debugRamadanDay,
                };

                setSettings({ ...DEFAULT_SETTINGS, ...loaded });
            }
        } catch (e) {
            console.error('Failed to load settings', e);
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
            console.error('Failed to save settings', e);
        }
    };

    const resetSettings = async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setSettings(DEFAULT_SETTINGS);
        } catch (e) {
            console.error('Failed to reset settings', e);
        }
    };

    // if (!isReady) return null; // Don't block render. Allow async update.

    const theme = settings.isDarkMode ? MD3DarkTheme : PremiumTheme;

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
