/**
 * HadithContext — Provides curated daily hadith with local data.
 * Includes: refresh limits (3/day free), bookmark system, and history tracking.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { CuratedHadith } from '../domain/HadithTypes';
import { getAllCuratedHadiths } from '../domain/CuratedHadiths';
import { HadithBookmarkService } from './HadithBookmarkService';
import { WidgetBridge } from '../../../../modules/widget-bridge/src';
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';
import { useAuth } from '../../auth/infrastructure/AuthContext';

const STORAGE_KEY = 'daily_hadith_data';
const HISTORY_KEY = 'daily_hadith_history';
const REFRESH_COUNT_KEY = 'daily_hadith_refresh_count';
const FREE_REFRESH_LIMIT = 3;

/** Clear all hadith data (used on logout/login to prevent leaking between accounts) */
export async function clearAllHadithData(userId?: string | null): Promise<void> {
    try {
        await Promise.all([
            UserScopedStorage.removeItem(STORAGE_KEY, userId),
            UserScopedStorage.removeItem(HISTORY_KEY, userId),
            UserScopedStorage.removeItem(REFRESH_COUNT_KEY, userId),
        ]);
    } catch (e) {
        if (__DEV__) console.warn('[HadithContext] clearAllHadithData failed:', e);
    }
}

interface HadithContextType {
    hadith: CuratedHadith | null;
    loading: boolean;
    refresh: () => Promise<void>;
    /** How many refreshes used today */
    refreshCount: number;
    /** Whether the user can still refresh (based on free limit) */
    canRefresh: boolean;
    /** Bookmark state */
    bookmarkedIds: string[];
    toggleBookmark: (hadithId: string) => Promise<boolean>;
    isBookmarked: (hadithId: string) => boolean;
    /** Set a specific hadith as today's (from library) */
    setHadith: (h: CuratedHadith) => Promise<void>;
}

const HadithContext = createContext<HadithContextType>({
    hadith: null,
    loading: true,
    refresh: async () => { },
    refreshCount: 0,
    canRefresh: true,
    bookmarkedIds: [],
    toggleBookmark: async () => false,
    isBookmarked: () => false,
    setHadith: async () => { },
});

export const useHadith = () => useContext(HadithContext);

/** Sync hadith data to iOS widget */
function syncHadithToWidget(h: CuratedHadith) {
    try {
        WidgetBridge.setDailyHadith({
            arabicText: h.arabicText,
            englishText: h.englishText,
            narrator: h.narrator,
            collection: h.collection,
            reference: h.reference,
        });
    } catch (err) {
        if (__DEV__) console.warn('[HadithContext] Widget sync failed:', err);
    }
}

/** Pick a random hadith avoiding recent history */
async function pickNextHadith(userId?: string | null): Promise<CuratedHadith> {
    const allHadiths = getAllCuratedHadiths();
    let history: string[] = [];

    try {
        const storedHistory = await UserScopedStorage.getItem(HISTORY_KEY, userId);
        if (storedHistory) history = JSON.parse(storedHistory);
    } catch (_e) {
        if (__DEV__) console.warn('[HadithContext] Failed to parse history:', _e);
    }

    // Filter out recently shown hadiths
    let available = allHadiths.filter(h => !history.includes(h.id));
    if (available.length === 0) {
        history = [];
        available = allHadiths;
    }

    const picked = available[Math.floor(Math.random() * available.length)];
    history.push(picked.id);

    try {
        await UserScopedStorage.setItem(HISTORY_KEY, userId, JSON.stringify(history));
    } catch (_e) {
        if (__DEV__) console.warn('[HadithContext] Failed to save history:', _e);
    }

    return picked;
}

/** Get today's date key */
function todayKey(): string {
    return new Date().toISOString().split('T')[0];
}

/** Load today's refresh count from AsyncStorage */
async function loadRefreshCount(userId?: string | null): Promise<number> {
    try {
        const stored = await UserScopedStorage.getItem(REFRESH_COUNT_KEY, userId);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.date === todayKey()) return parsed.count;
        }
    } catch (_e) { /* ignore */ }
    return 0;
}

/** Save today's refresh count */
async function saveRefreshCount(count: number, userId?: string | null): Promise<void> {
    await UserScopedStorage.setItem(REFRESH_COUNT_KEY, userId, JSON.stringify({
        date: todayKey(),
        count,
    }));
}

export const HadithProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [hadith, setHadithState] = useState<CuratedHadith | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshCount, setRefreshCount] = useState(0);
    const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

    const canRefresh = refreshCount < FREE_REFRESH_LIMIT;

    // Load bookmarks when the signed-in account changes.
    useEffect(() => {
        setBookmarkedIds([]);
        HadithBookmarkService.getBookmarks(userId).then(setBookmarkedIds);
    }, [userId]);

    const loadDailyHadith = useCallback(async () => {
        try {
            const stored = await UserScopedStorage.getItem(STORAGE_KEY, userId);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.date === todayKey()) {
                    setHadithState(parsed.hadith);
                    syncHadithToWidget(parsed.hadith);
                    setLoading(false);
                    // Load today's refresh count
                    const count = await loadRefreshCount(userId);
                    setRefreshCount(count);
                    return;
                }
            }

            // New day — pick a fresh hadith, reset refresh count
            const nextHadith = await pickNextHadith(userId);
            setHadithState(nextHadith);
            syncHadithToWidget(nextHadith);
            setRefreshCount(0);
            await saveRefreshCount(0, userId);
            await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify({
                date: todayKey(),
                hadith: nextHadith,
            }));
        } catch (err) {
            if (__DEV__) console.warn('[HadithContext] Load failed:', err);
            const fallback = getAllCuratedHadiths()[0];
            setHadithState(fallback);
            syncHadithToWidget(fallback);
        } finally {
            setLoading(false);
        }
    }, [userId]);

    /** Refresh — pick a new hadith (user-triggered). Increments refresh count. */
    const refresh = useCallback(async () => {
        try {
            const nextHadith = await pickNextHadith(userId);
            setHadithState(nextHadith);
            syncHadithToWidget(nextHadith);
            const newCount = refreshCount + 1;
            setRefreshCount(newCount);
            await saveRefreshCount(newCount, userId);
            await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify({
                date: todayKey(),
                hadith: nextHadith,
            }));
        } catch (err) {
            if (__DEV__) console.warn('[HadithContext] Refresh failed:', err);
        }
    }, [refreshCount, userId]);

    /** Set a specific hadith from the library */
    const setHadith = useCallback(async (h: CuratedHadith) => {
        setHadithState(h);
        syncHadithToWidget(h);
        await UserScopedStorage.setItem(STORAGE_KEY, userId, JSON.stringify({
            date: todayKey(),
            hadith: h,
        }));
    }, [userId]);

    /** Toggle bookmark — returns true if added, false if removed */
    const toggleBookmark = useCallback(async (hadithId: string): Promise<boolean> => {
        const isCurrentlyBookmarked = bookmarkedIds.includes(hadithId);
        if (isCurrentlyBookmarked) {
            await HadithBookmarkService.removeBookmark(hadithId, userId);
            setBookmarkedIds(prev => prev.filter(id => id !== hadithId));
            return false;
        } else {
            await HadithBookmarkService.addBookmark(hadithId, userId);
            setBookmarkedIds(prev => [...prev, hadithId]);
            return true;
        }
    }, [bookmarkedIds, userId]);

    const isBookmarked = useCallback((hadithId: string): boolean => {
        return bookmarkedIds.includes(hadithId);
    }, [bookmarkedIds]);

    useEffect(() => {
        loadDailyHadith();
    }, [loadDailyHadith]);

    // Reload when app returns to foreground
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
            if (nextAppState === 'active') {
                loadDailyHadith();
            }
        });
        return () => subscription.remove();
    }, [loadDailyHadith]);

    return (
        <HadithContext.Provider value={{
            hadith,
            loading,
            refresh,
            refreshCount,
            canRefresh,
            bookmarkedIds,
            toggleBookmark,
            isBookmarked,
            setHadith,
        }}>
            {children}
        </HadithContext.Provider>
    );
};
