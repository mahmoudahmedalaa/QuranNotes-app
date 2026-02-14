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
};

