/**
 * Khatma Context — Self-Paced Juz Tracker
 * No day/calendar mapping. User reads at their own pace and toggles Juz complete.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJuzInfo, JuzInfo } from '../../data/khatmaData';
import { useAuth } from '../auth/AuthContext';
import { KhatmaReadingPosition } from './KhatmaReadingPosition';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KhatmaState {
    completedJuz: number[];
    year: number;
    isComplete: boolean;
    /** ISO date string of last progress */
    lastProgressDate?: string;
    currentRound: number;
    completedRounds: number[];
    streakCount: number;
}

interface JuzProgress {
    isComplete: boolean;
}

interface KhatmaContextType {
    completedJuz: number[];
    isComplete: boolean;
    totalPagesRead: number;
    loading: boolean;
    getJuzProgress: (juzNumber: number) => JuzProgress;
    markJuzComplete: (juzNumber: number) => Promise<void>;
    unmarkJuz: (juzNumber: number) => Promise<void>;
    toggleJuz: (juzNumber: number) => Promise<void>;
    resetKhatma: () => Promise<void>;
    startNextRound: () => Promise<void>;
    streakDays: number;
    currentRound: number;
    completedRounds: number[];
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

const INITIAL_STATE = (year: number): KhatmaState => ({
    completedJuz: [],
    year,
    isComplete: false,
    currentRound: 1,
    completedRounds: [],
    streakCount: 0,
});

export const KhatmaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const currentYear = new Date().getFullYear();
    const { user } = useAuth();
    const prevUidRef = useRef<string | null | undefined>(undefined);

    const [state, setState] = useState<KhatmaState>(INITIAL_STATE(currentYear));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadProgress();
    }, []);

    // Reset on auth change
    useEffect(() => {
        const currentUid = user?.id ?? null;
        if (prevUidRef.current === undefined) {
            prevUidRef.current = currentUid;
            return;
        }
        if (currentUid !== prevUidRef.current) {
            prevUidRef.current = currentUid;
            if (__DEV__) console.log(`[Khatma] Auth user changed, reloading...`);
            loadProgress();
        }
    }, [user?.id]);

    const loadProgress = async () => {
        try {
            const key = getStorageKey(currentYear);
            const raw = await AsyncStorage.getItem(key);
            if (raw) {
                const parsed = JSON.parse(raw) as KhatmaState;
                if (Array.isArray(parsed.completedJuz)) {
                    if (__DEV__) console.log(`[Khatma] Loaded: ${parsed.completedJuz.length} Juz completed`);
                    setState({
                        completedJuz: parsed.completedJuz.filter(
                            (n: number, i: number, arr: number[]) =>
                                typeof n === 'number' && n >= 1 && n <= 30 && arr.indexOf(n) === i
                        ),
                        year: parsed.year || currentYear,
                        isComplete: parsed.isComplete || false,
                        lastProgressDate: parsed.lastProgressDate,
                        currentRound: parsed.currentRound || 1,
                        completedRounds: parsed.completedRounds || [],
                        streakCount: parsed.streakCount || 0,
                    });
                } else {
                    setState(INITIAL_STATE(currentYear));
                }
            } else {
                setState(INITIAL_STATE(currentYear));
            }
        } catch (e) {
            if (__DEV__) console.error('[Khatma] Load failed:', e);
        } finally {
            setLoading(false);
        }
    };

    const saveProgress = async (newState: KhatmaState) => {
        try {
            await AsyncStorage.setItem(getStorageKey(newState.year), JSON.stringify(newState));
        } catch (e) {
            if (__DEV__) console.error('[Khatma] Save failed:', e);
        }
    };

    const getJuzProgress = useCallback((juzNumber: number): JuzProgress => ({
        isComplete: state.completedJuz.includes(juzNumber),
    }), [state.completedJuz]);

    const markJuzComplete = useCallback(async (juzNumber: number) => {
        if (juzNumber < 1 || juzNumber > 30) return;
        setState(prev => {
            if (prev.completedJuz.includes(juzNumber)) return prev;
            const updated = [...prev.completedJuz, juzNumber].sort((a, b) => a - b);
            const newState: KhatmaState = {
                ...prev,
                completedJuz: updated,
                isComplete: updated.length >= 30,
                lastProgressDate: todayDateString(),
            };
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
                const newState: KhatmaState = {
                    ...prev,
                    completedJuz: updated,
                    isComplete: updated.length >= 30,
                    lastProgressDate: todayDateString(),
                };
                saveProgress(newState);
                return newState;
            }
        });
    }, []);

    const resetKhatma = useCallback(async () => {
        const newState = INITIAL_STATE(currentYear);
        setState(newState);
        await saveProgress(newState);
        // Clear all Juz-specific reading positions so nothing shows as "in progress"
        await KhatmaReadingPosition.clearAll();
    }, [currentYear]);

    const startNextRound = useCallback(async () => {
        // Clear all Juz-specific reading positions FIRST
        // so JuzGrid won't show stale "in progress" state
        await KhatmaReadingPosition.clearAll();
        setState(prev => {
            const newState: KhatmaState = {
                completedJuz: [],
                year: currentYear,
                isComplete: false,
                currentRound: prev.currentRound + 1,
                completedRounds: [...prev.completedRounds, Date.now()],
                streakCount: prev.streakCount,
                lastProgressDate: prev.lastProgressDate,
            };
            saveProgress(newState);
            return newState;
        });
    }, [currentYear]);

    // ─── Derived values ──────────────────────────────────────────────────

    const totalPagesRead = useMemo(() => {
        let total = 0;
        for (const juzNum of state.completedJuz) {
            const juz = getJuzInfo(juzNum);
            total += juz?.totalPages ?? 20;
        }
        return total;
    }, [state.completedJuz]);

    // Trial: 3 days from first use
    const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
    useEffect(() => {
        AsyncStorage.getItem('khatma_trial_start').then(date => {
            if (date) {
                setTrialStartDate(date);
            } else {
                const today = todayDateString();
                AsyncStorage.setItem('khatma_trial_start', today);
                setTrialStartDate(today);
            }
        });
    }, []);

    const isTrialExpired = useMemo(() => {
        if (!trialStartDate) return false;
        const start = new Date(trialStartDate + 'T00:00:00');
        const diffDays = Math.floor((Date.now() - start.getTime()) / 86400000);
        return diffDays >= 3;
    }, [trialStartDate]);

    // Streak
    const streakDays = useMemo(() => {
        if (!state.lastProgressDate) return 0;
        const lastDate = new Date(state.lastProgressDate + 'T00:00:00');
        const today = new Date(todayDateString() + 'T00:00:00');
        const diffDays = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
        if (diffDays === 0) return Math.max(state.streakCount, 1);
        if (diffDays === 1) return state.streakCount + 1;
        return 0;
    }, [state.lastProgressDate, state.streakCount]);

    const value: KhatmaContextType = {
        completedJuz: state.completedJuz,
        isComplete: state.isComplete,
        totalPagesRead,
        loading,
        getJuzProgress,
        markJuzComplete,
        unmarkJuz,
        toggleJuz,
        resetKhatma,
        startNextRound,
        streakDays,
        currentRound: state.currentRound,
        completedRounds: state.completedRounds,
        isTrialExpired,
    };

    return (
        <KhatmaContext.Provider value={value}>
            {children}
        </KhatmaContext.Provider>
    );
};
