/**
 * ReadingHistoryService
 * Stores a chronological list of recent reading/listening sessions.
 * Each entry records which surah + verse was read and when.
 * Capped at 30 entries. Deduplicates same-surah entries within 5 minutes.
 */
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';

const HISTORY_KEY = 'reading_history';
const MAX_ENTRIES = 30;
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export interface ReadingHistoryEntry {
    surah: number;
    surahName: string;
    verse: number;
    timestamp: number;
    source: 'audio' | 'reading';
}

export const ReadingHistoryService = {
    /** Add a new entry. Deduplicates same-surah within 5 min window. */
    async addEntry(entry: ReadingHistoryEntry, userId?: string | null): Promise<void> {
        try {
            const history = await this.getHistory(userId);

            // Dedup: if last entry is same surah within 5 min, update it instead
            if (history.length > 0) {
                const latest = history[0];
                if (
                    latest.surah === entry.surah &&
                    (entry.timestamp - latest.timestamp) < DEDUP_WINDOW_MS
                ) {
                    // Update the existing entry with new verse/timestamp
                    history[0] = { ...entry };
                    await UserScopedStorage.setItem(HISTORY_KEY, userId, JSON.stringify(history));
                    return;
                }
            }

            // Prepend new entry, cap at MAX_ENTRIES
            const updated = [entry, ...history].slice(0, MAX_ENTRIES);
            await UserScopedStorage.setItem(HISTORY_KEY, userId, JSON.stringify(updated));
        } catch (e) {
            if (__DEV__) console.warn('[ReadingHistoryService] addEntry failed:', e);
        }
    },

    /** Get all history entries, newest first. */
    async getHistory(userId?: string | null): Promise<ReadingHistoryEntry[]> {
        try {
            const raw = await UserScopedStorage.getItem(HISTORY_KEY, userId);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },

    /** Clear all history (used on logout). */
    async clearHistory(userId?: string | null): Promise<void> {
        try {
            await UserScopedStorage.removeItem(HISTORY_KEY, userId);
        } catch (e) {
            if (__DEV__) console.warn('[ReadingHistoryService] clearHistory failed:', e);
        }
    },
};
