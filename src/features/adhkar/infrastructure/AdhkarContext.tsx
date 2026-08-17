import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import adhkarData from '../data/adhkar.json';
import { ReviewService } from '../../../core/services/ReviewService';
import { CloudSyncEvents } from '../../../core/application/services/CloudSyncEvents';
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';
import { useAuth } from '../../auth/infrastructure/AuthContext';

// ── Types ────────────────────────────────────────────────────────────
export interface Dhikr {
    id: string;
    arabic: string;
    translation: string;
    source: string;
    repeatCount: number;
    category: string;
}

export type AdhkarPeriod = 'morning' | 'evening' | 'night';

export interface AdhkarProgress {
    /** Date string (YYYY-MM-DD) */
    date: string;
    /** Map of dhikr ID → count completed */
    completed: Record<string, number>;
    /** Whether the session is fully completed */
    sessionDone: boolean;
}

interface DayProgress {
    morning: AdhkarProgress | null;
    evening: AdhkarProgress | null;
    night: AdhkarProgress | null;
}

interface AdhkarContextType {
    adhkar: { morning: Dhikr[]; evening: Dhikr[]; night: Dhikr[] };
    todayProgress: DayProgress;
    incrementCount: (period: AdhkarPeriod, dhikrId: string) => Promise<void>;
    resetDhikr: (period: AdhkarPeriod, dhikrId: string) => Promise<void>;
    getCompletionPercentage: (period: AdhkarPeriod) => number;
    getTotalCompleted: (period: AdhkarPeriod) => number;
    getTotalRequired: (period: AdhkarPeriod) => number;
    isSessionComplete: (period: AdhkarPeriod) => boolean;
    getStreak: () => number;
    isLoading: boolean;
}

const STORAGE_KEY = 'adhkar_progress';
const STREAK_KEY = 'adhkar_streak';

const AdhkarContext = createContext<AdhkarContextType>({
    adhkar: adhkarData as any,
    todayProgress: { morning: null, evening: null, night: null },
    incrementCount: async () => { },
    resetDhikr: async () => { },
    getCompletionPercentage: () => 0,
    getTotalCompleted: () => 0,
    getTotalRequired: () => 0,
    isSessionComplete: () => false,
    getStreak: () => 0,
    isLoading: true,
});

export const useAdhkar = () => useContext(AdhkarContext);

// ── Helpers ──────────────────────────────────────────────────────────
function getToday(): string {
    return new Date().toISOString().split('T')[0];
}

function getStorageKey(date: string, period: AdhkarPeriod): string {
    return `${STORAGE_KEY}_${date}_${period}`;
}

// ── Provider ─────────────────────────────────────────────────────────
export const AdhkarProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [todayProgress, setTodayProgress] = useState<DayProgress>({ morning: null, evening: null, night: null });
    const [streak, setStreak] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    const adhkar = adhkarData as { morning: Dhikr[]; evening: Dhikr[]; night: Dhikr[] };

    // Load today's progress
    const loadProgress = useCallback(async () => {
        setIsLoading(true);
        try {
            if (!userId) {
                setTodayProgress({ morning: null, evening: null, night: null });
                return;
            }
            const today = getToday();
            const [morningData, eveningData, nightData] = await Promise.all([
                UserScopedStorage.getItem(getStorageKey(today, 'morning'), userId),
                UserScopedStorage.getItem(getStorageKey(today, 'evening'), userId),
                UserScopedStorage.getItem(getStorageKey(today, 'night'), userId),
            ]);

            setTodayProgress({
                morning: morningData ? JSON.parse(morningData) : null,
                evening: eveningData ? JSON.parse(eveningData) : null,
                night: nightData ? JSON.parse(nightData) : null,
            });
        } catch (e) {
            if (__DEV__) console.error('Failed to load adhkar progress:', e);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const loadStreak = useCallback(async () => {
        try {
            if (!userId) {
                setStreak(0);
                return;
            }
            const data = await UserScopedStorage.getItem(STREAK_KEY, userId);
            if (data) {
                const { count, lastDate } = JSON.parse(data);
                const today = getToday();
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayStr = yesterday.toISOString().split('T')[0];

                if (lastDate === today || lastDate === yesterdayStr) {
                    setStreak(count);
                } else {
                    setStreak(0);
                    await UserScopedStorage.setItem(STREAK_KEY, userId, JSON.stringify({ count: 0, lastDate: today }));
                }
            } else {
                setStreak(0);
            }
        } catch (e) {
            if (__DEV__) console.error('Failed to load adhkar streak:', e);
        }
    }, [userId]);

    useEffect(() => {
        loadProgress();
        loadStreak();
    }, [loadProgress, loadStreak]);

    // Re-read when cloud sync pulls remote data
    useEffect(() => {
        return CloudSyncEvents.onPull(() => {
            loadProgress();
            loadStreak();
        });
    }, [loadProgress, loadStreak]);

    const saveProgress = useCallback(async (period: AdhkarPeriod, progress: AdhkarProgress) => {
        try {
            if (!userId) return;
            const today = getToday();
            await UserScopedStorage.setItem(getStorageKey(today, period), userId, JSON.stringify(progress));
        } catch (e) {
            if (__DEV__) console.error('Failed to save adhkar progress:', e);
        }
    }, [userId]);

    const updateStreak = useCallback(async () => {
        try {
            if (!userId) return;
            const today = getToday();
            const data = await UserScopedStorage.getItem(STREAK_KEY, userId);
            let count = 0;
            let lastDate = '';

            if (data) {
                const parsed = JSON.parse(data);
                count = parsed.count;
                lastDate = parsed.lastDate;
            }

            if (lastDate !== today) {
                count += 1;
                await UserScopedStorage.setItem(STREAK_KEY, userId, JSON.stringify({ count, lastDate: today }));
                setStreak(count);

                // Trigger smart review prompt at streak milestones (3, 7, 14, 30)
                ReviewService.onAdhkarStreakUpdate(count);
            }
        } catch (e) {
            if (__DEV__) console.error('Failed to update adhkar streak:', e);
        }
    }, [userId]);

    const incrementCount = useCallback(
        async (period: AdhkarPeriod, dhikrId: string) => {
            const today = getToday();
            const current = todayProgress[period] || {
                date: today,
                completed: {},
                sessionDone: false,
            };

            const dhikrList = adhkar[period];
            const dhikr = dhikrList.find((d) => d.id === dhikrId);
            if (!dhikr) return;

            const currentCount = current.completed[dhikrId] || 0;
            if (currentCount >= dhikr.repeatCount) return; // Already complete

            const newCount = currentCount + 1;
            const updated: AdhkarProgress = {
                ...current,
                completed: { ...current.completed, [dhikrId]: newCount },
            };

            // Check if all dhikr in this period are complete
            const allComplete = dhikrList.every((d) => {
                const c = updated.completed[d.id] || 0;
                return c >= d.repeatCount;
            });
            updated.sessionDone = allComplete;

            setTodayProgress((prev) => ({ ...prev, [period]: updated }));
            await saveProgress(period, updated);

            if (allComplete) {
                await updateStreak();
            }
        },
        [todayProgress, adhkar, saveProgress, updateStreak],
    );

    const resetDhikr = useCallback(
        async (period: AdhkarPeriod, dhikrId: string) => {
            const today = getToday();
            const current = todayProgress[period] || {
                date: today,
                completed: {},
                sessionDone: false,
            };

            const updated: AdhkarProgress = {
                ...current,
                completed: { ...current.completed, [dhikrId]: 0 },
                sessionDone: false,
            };

            setTodayProgress((prev) => ({ ...prev, [period]: updated }));
            await saveProgress(period, updated);
        },
        [todayProgress, saveProgress],
    );

    const getCompletionPercentage = useCallback(
        (period: AdhkarPeriod): number => {
            const dhikrList = adhkar[period];
            const progress = todayProgress[period];
            if (!progress) return 0;

            const totalRequired = dhikrList.reduce((sum, d) => sum + d.repeatCount, 0);
            const totalDone = dhikrList.reduce((sum, d) => {
                const count = progress.completed[d.id] || 0;
                return sum + Math.min(count, d.repeatCount);
            }, 0);

            return totalRequired > 0 ? Math.round((totalDone / totalRequired) * 100) : 0;
        },
        [todayProgress, adhkar],
    );

    const getTotalCompleted = useCallback(
        (period: AdhkarPeriod): number => {
            const progress = todayProgress[period];
            if (!progress) return 0;
            return Object.values(progress.completed).reduce((sum, c) => sum + c, 0);
        },
        [todayProgress],
    );

    const getTotalRequired = useCallback(
        (period: AdhkarPeriod): number => {
            return adhkar[period].reduce((sum, d) => sum + d.repeatCount, 0);
        },
        [adhkar],
    );

    const isSessionComplete = useCallback(
        (period: AdhkarPeriod): boolean => {
            return todayProgress[period]?.sessionDone ?? false;
        },
        [todayProgress],
    );

    const getStreak = useCallback(() => streak, [streak]);

    return (
        <AdhkarContext.Provider
            value={{
                adhkar,
                todayProgress,
                incrementCount,
                resetDhikr,
                getCompletionPercentage,
                getTotalCompleted,
                getTotalRequired,
                isSessionComplete,
                getStreak,
                isLoading,
            }}
        >
            {children}
        </AdhkarContext.Provider>
    );
};
