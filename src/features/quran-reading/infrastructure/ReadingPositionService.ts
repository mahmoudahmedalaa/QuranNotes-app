/**
 * ReadingPositionService
 * Stores one "reading bookmark" per surah — the last verse the user manually bookmarked.
 * Also stores a global "most recent" position across all surahs for the home screen.
 * Independent from Khatma/Juz tracking so it works for any surah, any time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserScopedStorage, getUserScopedKey } from '../../../core/storage/UserScopedStorage';

const PREFIX = 'reading_position_surah_';
const GLOBAL_KEY = 'reading_position_global';

export interface ReadingPosition {
    surah: number;
    verse: number;
    timestamp: number;
    surahName?: string;
}

export const ReadingPositionService = {
    /** Clear all reading positions (used on logout/signup to prevent leaking between accounts) */
    async clearAll(userId?: string | null): Promise<void> {
        try {
            const keys = await AsyncStorage.getAllKeys();
            const scopedPrefix = userId ? getUserScopedKey(PREFIX, userId) : null;
            const scopedGlobal = userId ? getUserScopedKey(GLOBAL_KEY, userId) : null;
            const readingKeys = keys.filter(k => (
                k.startsWith(PREFIX) ||
                k === GLOBAL_KEY ||
                (scopedPrefix ? k.startsWith(scopedPrefix) : false) ||
                (scopedGlobal ? k === scopedGlobal : false)
            ));
            if (readingKeys.length > 0) {
                await AsyncStorage.multiRemove(readingKeys);
            }
        } catch (e) {
            if (__DEV__) console.warn('[ReadingPositionService] clearAll failed', e);
        }
    },

    /** Save (or overwrite) reading position for a surah + update global */
    async save(surahId: number, verseNumber: number, surahName?: string, userId?: string | null): Promise<void> {
        try {
            const pos: ReadingPosition = {
                surah: surahId,
                verse: verseNumber,
                timestamp: Date.now(),
                surahName,
            };
            await UserScopedStorage.setItem(`${PREFIX}${surahId}`, userId, JSON.stringify(pos));
            // Also update global "most recent" position
            await UserScopedStorage.setItem(GLOBAL_KEY, userId, JSON.stringify(pos));
        } catch (e) {
            if (__DEV__) console.warn('[ReadingPositionService] save failed', e);
        }
    },

    /** Get saved reading position for a surah (null if none) */
    async get(surahId: number, userId?: string | null): Promise<ReadingPosition | null> {
        try {
            const raw = await UserScopedStorage.getItem(`${PREFIX}${surahId}`, userId);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /** Get the most recently read position across all surahs */
    async getGlobal(userId?: string | null): Promise<ReadingPosition | null> {
        try {
            const raw = await UserScopedStorage.getItem(GLOBAL_KEY, userId);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /** Clear reading position for a surah */
    async clear(surahId: number, userId?: string | null): Promise<void> {
        try {
            await UserScopedStorage.removeItem(`${PREFIX}${surahId}`, userId);
        } catch (e) {
            if (__DEV__) console.warn('[ReadingPositionService] clear failed', e);
        }
    },

    /**
     * Get the most recently read position across a range of surahs.
     * Used by Khatma to detect if the user has read ANY surah in a Juz —
     * regardless of where they read it (homepage, Quran tab, or Khatma).
     */
    async getMostRecentInRange(startSurah: number, endSurah: number, userId?: string | null): Promise<ReadingPosition | null> {
        let mostRecent: ReadingPosition | null = null;
        for (let s = startSurah; s <= endSurah; s++) {
            try {
                const raw = await UserScopedStorage.getItem(`${PREFIX}${s}`, userId);
                if (raw) {
                    const pos: ReadingPosition = JSON.parse(raw);
                    if (!mostRecent || pos.timestamp > mostRecent.timestamp) {
                        mostRecent = pos;
                    }
                }
            } catch {
                // skip
            }
        }
        return mostRecent;
    },
};
