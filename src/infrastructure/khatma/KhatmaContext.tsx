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
    getJuzInfo,
    isPageInJuz,
    JuzInfo,
} from '../../data/khatmaData';

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
    /** Ramadan day when the current round started (0 = original, 15 = started on day 15) */
    roundStartDay: number;
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
    /** Current day number (1-30, based on day of month) */
    currentDay: number;
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
    /** Start a new Khatma round — recalibrates schedule */
    startNextRound: () => Promise<void>;
    /** Explicitly save a bookmark position (used by per-verse bookmark in VerseItem) */
    saveBookmark: (pageNumber: number, surahNumber: number, verseNumber: number, surahName?: string) => void;
    /** Current reading streak in days */
    streakDays: number;
    /** Current round number (1-based) */
    currentRound: number;
    /** Timestamps of completed rounds */
    completedRounds: number[];
    /** Day number used for Khatma scheduling (accounting for round start) */
    khatmaDay: number;
    /** True if the 3-day free trial has expired */
    isTrialExpired: boolean;
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
        roundStartDay: 0,
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
                    console.log(`[Khatma] Loaded progress: ${parsed.completedJuz.length} completed, ${Object.keys(parsed.pagesReadPerJuz || {}).length} Juz with pages tracked`);
                    // Log detailed page data for debugging
                    for (const [juz, pages] of Object.entries(parsed.pagesReadPerJuz || {})) {
                        if (Array.isArray(pages) && pages.length > 0) {
                            console.log(`[Khatma]   Juz ${juz}: ${pages.length} pages read`);
                        }
                    }
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
                        roundStartDay: parsed.roundStartDay || 0,
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
        if (!juzNumber) {
            console.warn('[Khatma] No Juz found for page:', pageNumber);
            return;
        }
        console.log(`[Khatma] Recording page ${pageNumber} → Juz ${juzNumber} (Surah ${surahNumber}:${verseNumber})`);

        setState(prev => {
            const currentPages = prev.pagesReadPerJuz[juzNumber] || [];
            // Already recorded this page
            if (currentPages.includes(pageNumber)) {
                // Always update last-read position to reflect user's current location
                // (even if going backwards — user may want to re-read earlier verses)
                const existingPos = prev.lastReadPosition[juzNumber];
                if (!existingPos || existingPos.page !== pageNumber || existingPos.verse !== verseNumber) {
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

        // Debug: log what we're returning so we can verify data flow
        if (pagesRead > 0 || isJuzComplete) {
            console.log(`[Khatma] getJuzProgress(${juzNumber}): ${pagesRead}/${totalPages} pages, complete=${isJuzComplete}`);
        }

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
                // "Start Over" — remove from completed AND clear saved position/pages
                const updated = prev.completedJuz.filter(n => n !== juzNumber);
                const { [juzNumber]: _pos, ...restPositions } = prev.lastReadPosition;
                const { [juzNumber]: _pages, ...restPages } = prev.pagesReadPerJuz;
                const { [juzNumber]: _surah, ...restSurah } = prev.lastReadSurah;
                const newState: KhatmaState = {
                    ...prev,
                    completedJuz: updated,
                    isComplete: false,
                    lastReadPosition: restPositions,
                    pagesReadPerJuz: restPages,
                    lastReadSurah: restSurah,
                };
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
            roundStartDay: 0,
        };
        setState(newState);
        await saveProgress(newState);
    }, [currentYear]);

    // ── Start another Khatma from current day (date recalibration) ──
    const startNextRound = useCallback(async () => {
        setState(prev => {
            const newRound = prev.currentRound + 1;
            const day = Math.min(30, new Date().getDate());
            const newState: KhatmaState = {
                completedJuz: [],
                pagesReadPerJuz: {},
                lastReadPosition: {},
                lastReadSurah: {},
                year: currentYear,
                isComplete: false,
                currentRound: newRound,
                completedRounds: [...prev.completedRounds, Date.now()],
                streakCount: prev.streakCount,
                lastProgressDate: prev.lastProgressDate,
                // Recalibrate: Juz 1 starts TODAY
                roundStartDay: day > 0 ? day - 1 : 0,
            };
            saveProgress(newState);
            return newState;
        });
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

    // Use day-of-month (1-31, capped at 30) — Khatma is a permanent feature
    const currentDay = Math.min(30, new Date().getDate());
    const totalPagesRead = useMemo(() => {
        let total = 0;
        for (const juzNum of Object.keys(state.pagesReadPerJuz)) {
            total += (state.pagesReadPerJuz[Number(juzNum)] || []).length;
        }
        for (const juzNum of state.completedJuz) {
            if (!state.pagesReadPerJuz[juzNum] || state.pagesReadPerJuz[juzNum].length === 0) {
                const juz = getJuzInfo(juzNum);
                total += juz?.totalPages ?? 0;
            }
        }
        return total;
    }, [state.pagesReadPerJuz, state.completedJuz]);

    // Adjusted "khatma day" — offset by round start for schedule recalibration
    const khatmaDay = Math.max(1, currentDay - (state.roundStartDay || 0));

    const catchUp = calculateDailyTarget(state.completedJuz, khatmaDay > 0 ? khatmaDay : 1, currentDay);

    // Today's reading — always available (not gated behind Ramadan)
    const todayReading = useMemo((): TodayReading | null => {
        if (khatmaDay < 1) return null;
        const juzNumber = Math.min(khatmaDay, 30);
        const juzInfo = getJuzForDay(juzNumber);
        if (!juzInfo) return null;

        const progress = getJuzProgress(juzNumber);
        return {
            juzNumber,
            juzInfo,
            pagesRead: progress.pagesRead,
            totalPages: progress.totalPages,
            percent: progress.percent,
            lastPosition: progress.lastPosition,
            isComplete: progress.isComplete,
        };
    }, [khatmaDay, getJuzProgress]);

    // ── Trial tracking: 3-day free trial for Khatma ──
    const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
    useEffect(() => {
        AsyncStorage.getItem('khatma_trial_start').then(date => {
            if (date) {
                setTrialStartDate(date);
            } else {
                // First time using Khatma — start trial
                const today = todayDateString();
                AsyncStorage.setItem('khatma_trial_start', today);
                setTrialStartDate(today);
            }
        });
    }, []);

    const isTrialExpired = useMemo(() => {
        if (!trialStartDate) return false;
        const start = new Date(trialStartDate + 'T00:00:00');
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - start.getTime()) / 86400000);
        return diffDays >= 3;
    }, [trialStartDate]);

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
        currentDay,
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
        startNextRound,
        saveBookmark,
        streakDays,
        currentRound: state.currentRound,
        completedRounds: state.completedRounds,
        khatmaDay,
        isTrialExpired,
    };

    return (
        <KhatmaContext.Provider value={value}>
            {children}
        </KhatmaContext.Provider>
    );
};
