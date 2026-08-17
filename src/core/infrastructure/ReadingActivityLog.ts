/**
 * ReadingActivityLog — Persistent, append-only log of reading sessions.
 *
 * Stored SEPARATELY from KhatmaState so it survives khatma resets and
 * new rounds. Maps date strings (YYYY-MM-DD) to arrays of surah numbers
 * completed that day, plus page counts for accurate time estimation.
 *
 * Used by useInsightsData to provide proper timeframe-based filtering.
 */
import { JUZ_DATA } from '../../features/khatma/data/khatmaData';
import { UserScopedStorage } from '../storage/UserScopedStorage';

const STORAGE_KEY = 'reading_activity_log';

export interface DailyReadingEntry {
    surahs: number[];   // surah numbers completed that day
    pages: number;      // total pages read that day
}

export type ReadingLog = Record<string, DailyReadingEntry>; // "2026-02-25" → entry

function todayStr(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Estimate pages for a single surah based on its Juz data */
function estimateSurahPages(surahNumber: number): number {
    // Find which Juz this surah belongs to
    for (const juz of JUZ_DATA) {
        if (surahNumber >= juz.startSurahNumber && surahNumber <= juz.endSurahNumber) {
            // Approximate: divide juz pages evenly across its surahs
            const surahCount = juz.endSurahNumber - juz.startSurahNumber + 1;
            return Math.round(juz.totalPages / surahCount);
        }
    }
    return 5; // fallback
}

export const ReadingActivityLog = {
    async load(userId: string | null | undefined): Promise<ReadingLog> {
        try {
            if (!userId) return {};
            const raw = await UserScopedStorage.getItem(STORAGE_KEY, userId);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    },

    async logSurahCompletion(surahNumber: number, userId: string | null | undefined): Promise<void> {
        try {
            if (!userId) return;
            const log = await this.load(userId);
            const today = todayStr();
            const existing = log[today] || { surahs: [], pages: 0 };

            if (!existing.surahs.includes(surahNumber)) {
                existing.surahs.push(surahNumber);
                existing.pages += estimateSurahPages(surahNumber);
            }

            log[today] = existing;
            await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify(log));
        } catch (e) {
            if (__DEV__) console.warn('[ReadingActivityLog] logSurahCompletion failed', e);
        }
    },

    /** Get pages read within a date range */
    getPagesInRange(log: ReadingLog, cutoff: Date | null): number {
        if (!cutoff) {
            // All time — sum everything
            return Object.values(log).reduce((sum, entry) => sum + entry.pages, 0);
        }
        let total = 0;
        for (const [dateStr, entry] of Object.entries(log)) {
            if (new Date(dateStr) >= cutoff) {
                total += entry.pages;
            }
        }
        return total;
    },

    /** Get surah count in a date range */
    getSurahsInRange(log: ReadingLog, cutoff: Date | null): number {
        if (!cutoff) {
            return Object.values(log).reduce((sum, entry) => sum + entry.surahs.length, 0);
        }
        let total = 0;
        for (const [dateStr, entry] of Object.entries(log)) {
            if (new Date(dateStr) >= cutoff) {
                total += entry.surahs.length;
            }
        }
        return total;
    },

    /**
     * One-time backfill: distribute existing completed surahs across
     * known activity dates from streak history. Only uses dates within
     * the last 30 days to avoid stale dev/test data. Reads activityHistory
     * directly from AsyncStorage to avoid circular dependency.
     */
    async backfillFromHistory(completedSurahs: number[], userId: string | null | undefined): Promise<ReadingLog> {
        if (completedSurahs.length === 0) return {};
        if (!userId) return {};

        try {
            // Read activity history from streak storage (no import needed)
            const streakRaw = await UserScopedStorage.getItem('reflection_streaks', userId);
            const activityHistory: Record<string, number> = streakRaw
                ? (JSON.parse(streakRaw).activityHistory || {})
                : {};

            // Only use dates within the last 30 days (avoid stale dev dates)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            thirtyDaysAgo.setHours(0, 0, 0, 0);

            const activeDates = Object.keys(activityHistory)
                .filter(d => (activityHistory[d] || 0) > 0 && new Date(d) >= thirtyDaysAgo)
                .sort(); // oldest first

            const sorted = [...completedSurahs].sort((a, b) => a - b);
            const log: ReadingLog = {};

            if (activeDates.length === 0) {
                // No recent history — put everything on today
                const today = todayStr();
                log[today] = {
                    surahs: sorted,
                    pages: sorted.reduce((sum, s) => sum + estimateSurahPages(s), 0),
                };
            } else {
                // Distribute surahs evenly across recent active dates
                const perDay = Math.max(1, Math.ceil(sorted.length / activeDates.length));
                let idx = 0;

                for (const dateStr of activeDates) {
                    if (idx >= sorted.length) break;
                    const chunk = sorted.slice(idx, idx + perDay);
                    log[dateStr] = {
                        surahs: chunk,
                        pages: chunk.reduce((sum, s) => sum + estimateSurahPages(s), 0),
                    };
                    idx += perDay;
                }
            }

            await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify(log));
            return log;
        } catch (e) {
            if (__DEV__) console.warn('[ReadingActivityLog] backfill failed', e);
            return {};
        }
    },

    /** Force re-seed: clear existing log and backfill again */
    async reseed(completedSurahs: number[], userId: string | null | undefined): Promise<ReadingLog> {
        if (!userId) return {};
        await UserScopedStorage.removeItem(STORAGE_KEY, userId);
        return this.backfillFromHistory(completedSurahs, userId);
    },

    /** Clear all data (for logout) */
    async clearAll(userId: string | null | undefined): Promise<void> {
        if (!userId) return;
        await UserScopedStorage.removeItem(STORAGE_KEY, userId);
    },
};
