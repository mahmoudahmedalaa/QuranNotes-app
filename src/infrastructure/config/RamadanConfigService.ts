/**
 * RamadanConfigService
 * Listens to Firestore `config/Ramadan` document in REAL-TIME via onSnapshot.
 * When dates are updated in Firebase Console, all open apps update instantly.
 * Caches locally via AsyncStorage so the app works offline.
 * Falls back to hardcoded defaults if both Firestore and cache miss.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase/config';

const CACHE_KEY = '@ramadan_config';

export interface RamadanDates {
    startDate: string; // ISO date string, e.g. "2026-02-18"
    endDate: string;   // ISO date string, e.g. "2026-03-19"
}

// Hardcoded defaults — used when Firestore + cache both fail
const DEFAULTS: RamadanDates = {
    startDate: '2026-02-18',
    endDate: '2026-03-19',
};

// Callback that ramadanUtils registers to receive live updates
let onDatesChanged: ((dates: RamadanDates) => void) | null = null;

export const RamadanConfigService = {
    /**
     * Register a callback for real-time date updates.
     * Called by ramadanUtils.initRamadanDates().
     */
    setOnDatesChanged(callback: (dates: RamadanDates) => void) {
        onDatesChanged = callback;
    },

    /**
     * One-time fetch. Tries Firestore first, then cache, then defaults.
     */
    async fetch(): Promise<RamadanDates> {
        try {
            const doc = await db.collection('config').doc('Ramadan').get();
            if (doc.exists) {
                const data = doc.data() as RamadanDates;
                if (data?.startDate && data?.endDate) {
                    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
                    return data;
                }
            }
        } catch (e) {
            if (__DEV__) console.log('[RamadanConfig] Firestore fetch failed, using cache');
        }

        // Try cache
        try {
            const cached = await AsyncStorage.getItem(CACHE_KEY);
            if (cached) {
                return JSON.parse(cached) as RamadanDates;
            }
        } catch (e) {
            if (__DEV__) console.log('[RamadanConfig] Cache read failed');
        }

        return DEFAULTS;
    },

    /**
     * Start real-time listener. Updates propagate instantly to all open apps.
     * Returns unsubscribe function.
     */
    listen(): () => void {
        const unsubscribe = db.collection('config').doc('Ramadan').onSnapshot(
            (doc) => {
                if (doc.exists) {
                    const data = doc.data() as RamadanDates;
                    if (data?.startDate && data?.endDate) {
                        // Cache for offline use
                        AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
                        // Notify ramadanUtils to update dates in real-time
                        if (onDatesChanged) {
                            onDatesChanged(data);
                        }
                        if (__DEV__) console.log(`[RamadanConfig] Live update: ${data.startDate} → ${data.endDate}`);
                    }
                }
            },
            (error) => {
                if (__DEV__) console.log('[RamadanConfig] Listener error:', error.message);
            }
        );
        return unsubscribe;
    },
};
