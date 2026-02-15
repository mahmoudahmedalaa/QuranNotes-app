/**
 * KhatmaReadingPosition — Tracks per-Juz reading position for the Khatma feature.
 * Separate from the global reading position so khatma navigation
 * doesn't get confused by general Quran browsing.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'khatma_juz_position_';

export interface KhatmaPosition {
    surah: number;
    verse: number;
    timestamp: number;
}

/**
 * In-memory session flag: which Juz the user is CURRENTLY reading from the Khatma page.
 * null = not reading from khatma (general browsing — don't save khatma positions).
 */
let activeKhatmaJuz: number | null = null;

export const KhatmaReadingPosition = {
    /**
     * Mark that the user started reading a specific Juz from the Khatma page.
     * The AudioKhatmaBridge will only save positions while this is set.
     */
    startSession(juzNumber: number): void {
        activeKhatmaJuz = juzNumber;
    },

    /**
     * Clear the active session (e.g., when navigating away from the surah).
     */
    endSession(): void {
        activeKhatmaJuz = null;
    },

    /**
     * Get the currently active Khatma Juz (null if not in a khatma session).
     */
    getActiveJuz(): number | null {
        return activeKhatmaJuz;
    },

    /**
     * Save reading position for a specific Juz in the khatma context.
     */
    async save(juzNumber: number, surah: number, verse: number): Promise<void> {
        try {
            const data: KhatmaPosition = { surah, verse, timestamp: Date.now() };
            await AsyncStorage.setItem(`${KEY_PREFIX}${juzNumber}`, JSON.stringify(data));
        } catch {
            // Silently fail
        }
    },

    /**
     * Get saved reading position for a specific Juz.
     */
    async get(juzNumber: number): Promise<KhatmaPosition | null> {
        try {
            const raw = await AsyncStorage.getItem(`${KEY_PREFIX}${juzNumber}`);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /**
     * Clear reading position for a Juz (e.g., when marking complete or starting over).
     */
    async clear(juzNumber: number): Promise<void> {
        try {
            await AsyncStorage.removeItem(`${KEY_PREFIX}${juzNumber}`);
        } catch {
            // Silently fail
        }
    },

    /**
     * Clear all khatma positions (e.g., on "Start Next Round").
     */
    async clearAll(): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const khatmaKeys = keys.filter(k => k.startsWith(KEY_PREFIX));
            if (khatmaKeys.length > 0) {
                await AsyncStorage.multiRemove(khatmaKeys);
            }
        } catch {
            // Silently fail
        }
    },
};

