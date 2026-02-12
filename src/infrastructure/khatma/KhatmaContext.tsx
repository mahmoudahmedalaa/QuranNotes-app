/**
 * Khatma Context
 * Manages Quran completion progress with page-level tracking and AsyncStorage persistence.
 * Automatically detects and records reading progress during Ramadan.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    calculateDailyTarget,
    getTotalPagesRead,
    getJuzForDay,
    getJuzForPage,
    isPageInJuz,
    JuzInfo,
} from '../../data/khatmaData';
import { currentRamadanDay, isRamadan } from '../../utils/ramadanUtils';
import { useSettings } from '../settings/SettingsContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface LastReadPosition {
    surah: number;
    surahName?: string;
    verse: number;
    page: number;
    timestamp: number;
}

interface KhatmaState {
    completedJuz: number[];
    /** Pages read per Juz: { 1: [1,2,3,5], 2: [22,23] } */
    pagesReadPerJuz: Record<number, number[]>;
    /** Exact resume point per Juz */
    lastReadPosition: Record<number, LastReadPosition>;
    /** Legacy: last-read surah number per Juz */
    lastReadSurah: Record<number, number>;
    year: number;
    isComplete: boolean;
    /** Date string (YYYY-MM-DD) of last progress to detect day changes */
    lastProgressDate?: string;
    /** Current round (1-based, default 1) */
    currentRound: number;
    /** Timestamps of completed rounds */
    completedRounds: number[];
    /** Current streak day count */
    streakCount: number;
}

interface JuzProgress {
    pagesRead: number;
    totalPages: number;
    percent: number;
    lastPosition?: LastReadPosition;
    isComplete: boolean;
}

interface TodayReading {
    juzNumber: number;
    juzInfo: JuzInfo;
    pagesRead: number;
    totalPages: number;
    percent: number;
    lastPosition?: LastReadPosition;
    isComplete: boolean;
}

interface KhatmaContextType {
    completedJuz: number[];
    isComplete: boolean;
    totalPagesRead: number;
    ramadanDay: number;
    isRamadanActive: boolean;
    catchUp: {
        remainingJuz: number;
        remainingDays: number;
        dailyTarget: number;
        isAhead: boolean;
        isBehind: boolean;
        message: string;
    };
    lastReadSurah: Record<number, number>;
    loading: boolean;
    /** Page-level progress for any Juz */
    getJuzProgress: (juzNumber: number) => JuzProgress;
    /** Today's reading summary */
    todayReading: TodayReading | null;
    /** Record a page as read — called automatically from Surah screen */
    recordPageRead: (pageNumber: number, surahNumber: number, verseNumber: number, surahName?: string) => void;
    markJuzComplete: (juzNumber: number) => Promise<void>;
    unmarkJuz: (juzNumber: number) => Promise<void>;
    toggleJuz: (juzNumber: number) => Promise<void>;
    setLastReadSurahForJuz: (juzNumber: number, surahNumber: number) => Promise<void>;
    resetKhatma: () => Promise<void>;
    /** Explicitly save a bookmark position (used by BookmarkFAB) */
    saveBookmark: (pageNumber: number, surahNumber: number, verseNumber: number, surahName?: string) => void;
    /** Current reading streak in days */
    streakDays: number;
    /** Current round number (1-based) */
    currentRound: number;
    /** Timestamps of completed rounds */
    completedRounds: number[];
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'khatma_progress';
const getStorageKey = (year: number) => `${STORAGE_KEY}_${year}`;

const todayDateString = () => new Date().toISOString().split('T')[0];

// ─── Context ─────────────────────────────────────────────────────────────────

const KhatmaContext = createContext<KhatmaContextType | undefined>(undefined);

export const useKhatma = (): KhatmaContextType => {
    const context = useContext(KhatmaContext);
    if (!context) {
        throw new Error('useKhatma must be used within a KhatmaProvider');
    }
    return context;
};

// ─── Provider ────────────────────────────────────────────────────────────────

export const KhatmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const currentYear = new Date().getFullYear();
    const { settings } = useSettings();

    const [state, setState] = useState<KhatmaState>({
        completedJuz: [],
        pagesReadPerJuz: {},
        lastReadPosition: {},
        lastReadSurah: {},
        year: currentYear,
        isComplete: false,
        currentRound: 1,
        completedRounds: [],
        streakCount: 0,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProgress();
    }, []);

    const loadProgress = async () => {
        try {
            const key = getStorageKey(currentYear);
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw) as KhatmaState;
                if (Array.isArray(parsed.completedJuz)) {
                    setState({
                        completedJuz: parsed.completedJuz.filter(
                            (n: number, i: number, arr: number[]) =>
                                typeof n === 'number' && n >= 1 && n <= 30 && arr.indexOf(n) === i
                        ),
                        pagesReadPerJuz: parsed.pagesReadPerJuz || {},
                        lastReadPosition: parsed.lastReadPosition || {},
                        lastReadSurah: parsed.lastReadSurah || {},
                        year: parsed.year || currentYear,
                        isComplete: parsed.isComplete || false,
                        lastProgressDate: parsed.lastProgressDate,
                        currentRound: parsed.currentRound || 1,
                        completedRounds: parsed.completedRounds || [],
                        streakCount: parsed.streakCount || 0,
                    });
                }
            }
        } catch (e) {
            console.error('[Khatma] Failed to load progress:', e);
        } finally {
            setLoading(false);
        }
    };

    const saveProgress = async (newState: KhatmaState) => {
        try {
            const key = getStorageKey(newState.year);
            await AsyncStorage.setItem(key, JSON.stringify(newState));
        } catch (e) {
            console.error('[Khatma] Failed to save progress:', e);
        }
    };

    // ─── Record page read (automatic tracking) ──────────────────────────────

    const recordPageRead = useCallback((
        pageNumber: number,
        surahNumber: number,
        verseNumber: number,
        surahName?: string,
    ) => {
        // Validate page number bounds (Quran has 604 pages)
        if (pageNumber < 1 || pageNumber > 604) {
            console.warn('[Khatma] Invalid page number:', pageNumber);
            return;
        }
        // Determine which Juz this page belongs to
        const juzNumber = getJuzForPage(pageNumber);
        if (!juzNumber) return;

        setState(prev => {
            const currentPages = prev.pagesReadPerJuz[juzNumber] || [];
            // Already recorded this page
            if (currentPages.includes(pageNumber)) {
                // Still update last-read position if it's a newer verse
                const existingPos = prev.lastReadPosition[juzNumber];
                if (!existingPos || existingPos.page < pageNumber ||
                    (existingPos.page === pageNumber && existingPos.verse < verseNumber)) {
                    const newState: KhatmaState = {
                        ...prev,
                        lastReadPosition: {
                            ...prev.lastReadPosition,
                            [juzNumber]: {
                                surah: surahNumber,
                                surahName,
                                verse: verseNumber,
                                page: pageNumber,
                                timestamp: Date.now(),
                            },
                        },
                        lastReadSurah: {
                            ...prev.lastReadSurah,
                            [juzNumber]: surahNumber,
                        },
                        lastProgressDate: todayDateString(),
                    };
                    saveProgress(newState);
                    return newState;
                }
                return prev;
            }

            const updatedPages = [...currentPages, pageNumber].sort((a, b) => a - b);
            const juzInfo = getJuzForDay(juzNumber);
            const totalPages = juzInfo?.totalPages ?? 20;

            // Auto-complete Juz when all pages are read
            const allPagesRead = updatedPages.length >= totalPages;
            let updatedCompletedJuz = prev.completedJuz;
            if (allPagesRead && !prev.completedJuz.includes(juzNumber)) {
                updatedCompletedJuz = [...prev.completedJuz, juzNumber].sort((a, b) => a - b);
            }

            const newState: KhatmaState = {
                ...prev,
                pagesReadPerJuz: {
                    ...prev.pagesReadPerJuz,
                    [juzNumber]: updatedPages,
                },
                lastReadPosition: {
                    ...prev.lastReadPosition,
                    [juzNumber]: {
                        surah: surahNumber,
                        surahName,
                        verse: verseNumber,
                        page: pageNumber,
                        timestamp: Date.now(),
                    },
                },
                lastReadSurah: {
                    ...prev.lastReadSurah,
                    [juzNumber]: surahNumber,
                },
                completedJuz: updatedCompletedJuz,
                isComplete: updatedCompletedJuz.length >= 30,
                lastProgressDate: todayDateString(),
            };
            saveProgress(newState);
            return newState;
        });
    }, []);

    // ─── Get progress for a specific Juz ──────────────────────────────────

    const getJuzProgress = useCallback((juzNumber: number): JuzProgress => {
        const juzInfo = getJuzForDay(juzNumber);
        const totalPages = juzInfo?.totalPages ?? 20;
        const pagesRead = (state.pagesReadPerJuz[juzNumber] || []).length;
        const isJuzComplete = state.completedJuz.includes(juzNumber);

        return {
            pagesRead: isJuzComplete ? totalPages : pagesRead,
            totalPages,
            percent: isJuzComplete ? 1 : Math.min(1, pagesRead / totalPages),
            lastPosition: state.lastReadPosition[juzNumber],
            isComplete: isJuzComplete,
        };
    }, [state.pagesReadPerJuz, state.lastReadPosition, state.completedJuz]);

    const markJuzComplete = useCallback(async (juzNumber: number) => {
        if (juzNumber < 1 || juzNumber > 30) return;
        setState(prev => {
            if (prev.completedJuz.includes(juzNumber)) return prev;
            const updated = [...prev.completedJuz, juzNumber].sort((a, b) => a - b);
            const newState: KhatmaState = { ...prev, completedJuz: updated, isComplete: updated.length >= 30 };
            saveProgress(newState);
            return newState;
        });
    }, []);

    const unmarkJuz = useCallback(async (juzNumber: number) => {
        setState(prev => {
            const updated = prev.completedJuz.filter(n => n !== juzNumber);
            const newState: KhatmaState = { ...prev, completedJuz: updated, isComplete: false };
            saveProgress(newState);
            return newState;
        });
    }, []);

    const toggleJuz = useCallback(async (juzNumber: number) => {
        setState(prev => {
            if (prev.completedJuz.includes(juzNumber)) {
                const updated = prev.completedJuz.filter(n => n !== juzNumber);
                const newState: KhatmaState = { ...prev, completedJuz: updated, isComplete: false };
                saveProgress(newState);
                return newState;
            } else {
                const updated = [...prev.completedJuz, juzNumber].sort((a, b) => a - b);
                const newState: KhatmaState = { ...prev, completedJuz: updated, isComplete: updated.length >= 30 };
                saveProgress(newState);
                return newState;
            }
        });
    }, []);

    const setLastReadSurahForJuz = useCallback(async (juzNumber: number, surahNumber: number) => {
        setState(prev => {
            const newState: KhatmaState = {
                ...prev,
                lastReadSurah: { ...prev.lastReadSurah, [juzNumber]: surahNumber },
            };
            saveProgress(newState);
            return newState;
        });
    }, []);

    const resetKhatma = useCallback(async () => {
        const newState: KhatmaState = {
            completedJuz: [],
            pagesReadPerJuz: {},
            lastReadPosition: {},
            lastReadSurah: {},
            year: currentYear,
            isComplete: false,
            currentRound: 1,
            completedRounds: [],
            streakCount: 0,
        };
        setState(newState);
        await saveProgress(newState);
    }, [currentYear]);

    // ── Explicit bookmark save (separate from auto-tracking) ──
    const saveBookmark = useCallback((
        pageNumber: number,
        surahNumber: number,
        verseNumber: number,
        surahName?: string,
    ) => {
        if (pageNumber < 1 || pageNumber > 604) return;
        const juzNumber = getJuzForPage(pageNumber);
        if (!juzNumber) return;

        setState(prev => {
            const newState: KhatmaState = {
                ...prev,
                lastReadPosition: {
                    ...prev.lastReadPosition,
                    [juzNumber]: {
                        surah: surahNumber,
                        surahName,
                        verse: verseNumber,
                        page: pageNumber,
                        timestamp: Date.now(),
                    },
                },
                lastReadSurah: {
                    ...prev.lastReadSurah,
                    [juzNumber]: surahNumber,
                },
                lastProgressDate: todayDateString(),
            };
            saveProgress(newState);
            return newState;
        });
    }, []);

    // ─── Derived values ──────────────────────────────────────────────────

    const debugOn = settings.debugSimulateRamadan;
    const debugDay = settings.debugRamadanDay;
    const ramadanDay = currentRamadanDay(debugOn, debugDay);
    const isRamadanActive = isRamadan(debugOn);
    const totalPagesRead = getTotalPagesRead(state.completedJuz);
    const catchUp = calculateDailyTarget(state.completedJuz, ramadanDay > 0 ? ramadanDay : 1);

    // Today's reading — derived from current Ramadan day
    const todayReading = useMemo((): TodayReading | null => {
        if (!isRamadanActive || ramadanDay < 1) return null;
        const juzInfo = getJuzForDay(ramadanDay);
        if (!juzInfo) return null;

        const progress = getJuzProgress(ramadanDay);
        return {
            juzNumber: ramadanDay,
            juzInfo,
            pagesRead: progress.pagesRead,
            totalPages: progress.totalPages,
            percent: progress.percent,
            lastPosition: progress.lastPosition,
            isComplete: progress.isComplete,
        };
    }, [isRamadanActive, ramadanDay, getJuzProgress]);

    // ── Streak tracking ──
    const streakDays = useMemo(() => {
        if (!state.lastProgressDate) return 0;
        const lastDate = new Date(state.lastProgressDate + 'T00:00:00');
        const today = new Date(todayDateString() + 'T00:00:00');
        const diffMs = today.getTime() - lastDate.getTime();
        const diffDays = Math.round(diffMs / 86400000);
        if (diffDays === 0) return Math.max(state.streakCount, 1);
        if (diffDays === 1) return state.streakCount + 1;
        return 0; // Streak broken
    }, [state.lastProgressDate, state.streakCount]);

    const value: KhatmaContextType = {
        completedJuz: state.completedJuz,
        isComplete: state.isComplete,
        totalPagesRead,
        ramadanDay,
        isRamadanActive,
        catchUp,
        lastReadSurah: state.lastReadSurah,
        loading,
        getJuzProgress,
        todayReading,
        recordPageRead,
        markJuzComplete,
        unmarkJuz,
        toggleJuz,
        setLastReadSurahForJuz,
        resetKhatma,
        saveBookmark,
        streakDays,
        currentRound: state.currentRound,
        completedRounds: state.completedRounds,
    };

    return (
        <KhatmaContext.Provider value={value}>
            {children}
        </KhatmaContext.Provider>
    );
};
