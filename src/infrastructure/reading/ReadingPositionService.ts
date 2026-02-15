/**
 * ReadingPositionService
 * Stores one "reading bookmark" per surah — the last verse the user manually bookmarked.
 * Also stores a global "most recent" position across all surahs for the home screen.
 * Independent from Khatma/Juz tracking so it works for any surah, any time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'reading_position_surah_';
const GLOBAL_KEY = 'reading_position_global';

export interface ReadingPosition {
    surah: number;
    verse: number;
    timestamp: number;
    surahName?: string;
}

export const ReadingPositionService = {
    /** Save (or overwrite) reading position for a surah + update global */
    async save(surahId: number, verseNumber: number, surahName?: string): Promise<void> {
        const pos: ReadingPosition = {
            surah: surahId,
            verse: verseNumber,
            timestamp: Date.now(),
            surahName,
        };
        await AsyncStorage.setItem(`${PREFIX}${surahId}`, JSON.stringify(pos));
        // Also update global "most recent" position
        await AsyncStorage.setItem(GLOBAL_KEY, JSON.stringify(pos));
    },

    /** Get saved reading position for a surah (null if none) */
    async get(surahId: number): Promise<ReadingPosition | null> {
        try {
            const raw = await AsyncStorage.getItem(`${PREFIX}${surahId}`);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /** Get the most recently read position across all surahs */
    async getGlobal(): Promise<ReadingPosition | null> {
        try {
            const raw = await AsyncStorage.getItem(GLOBAL_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    },

    /** Clear reading position for a surah */
    async clear(surahId: number): Promise<void> {
        await AsyncStorage.removeItem(`${PREFIX}${surahId}`);
    },

    /**
     * Get the most recently read position across a range of surahs.
     * Used by Khatma to detect if the user has read ANY surah in a Juz —
     * regardless of where they read it (homepage, Quran tab, or Khatma).
     */
    async getMostRecentInRange(startSurah: number, endSurah: number): Promise<ReadingPosition | null> {
        let mostRecent: ReadingPosition | null = null;
        for (let s = startSurah; s <= endSurah; s++) {
            try {
                const raw = await AsyncStorage.getItem(`${PREFIX}${s}`);
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

