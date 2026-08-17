/**
 * KhatmaService — Pure business logic for Khatma progress tracking.
 * No React, no hooks, no side-effects. Fully testable.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { JUZ_DATA } from '../data/khatmaData';
import { UserScopedStorage } from '../../../core/storage/UserScopedStorage';

// ─── Constants ───────────────────────────────────────────────────────────────

export const FREE_JUZ_LIMIT = 2;
const STORAGE_KEY = 'khatma_progress';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface KhatmaState {
    completedSurahs: number[];
    year: number;
    lastProgressDate?: string;
    currentRound: number;
    completedRounds: number[];
    streakCount: number;
}

// ─── Pure derivation helpers ─────────────────────────────────────────────────

export const todayDateString = (): string => new Date().toISOString().split('T')[0];

/**
 * Derive which Juz are complete from the list of completed surahs.
 * A Juz is complete when ALL surahs from 1..endSurahNumber are complete.
 */
export function deriveCompletedJuz(completedSurahs: number[]): number[] {
    if (completedSurahs.length === 0) return [];
    const highestCompleted = Math.max(...completedSurahs);
    return JUZ_DATA
        .filter(juz => juz.endSurahNumber <= highestCompleted)
        .map(juz => juz.juzNumber);
}

/**
 * Which Juz is the user currently reading in?
 */
export function deriveCurrentJuz(nextSurahNumber: number): number {
    const juz = JUZ_DATA.find(j =>
        nextSurahNumber >= j.startSurahNumber && nextSurahNumber <= j.endSurahNumber
    );
    return juz?.juzNumber ?? 1;
}

/**
 * Find the next unread surah number.
 */
export function deriveNextSurahNumber(completedSurahs: number[]): number {
    for (let i = 1; i <= 114; i++) {
        if (!completedSurahs.includes(i)) return i;
    }
    return 114;
}

/**
 * Calculate total pages read from completed Juz.
 */
export function deriveTotalPagesRead(completedJuz: number[]): number {
    let total = 0;
    for (const juzNum of completedJuz) {
        const juz = JUZ_DATA.find(j => j.juzNumber === juzNum);
        total += juz?.totalPages ?? 20;
    }
    return total;
}

/**
 * Calculate the current streak from last progress date.
 */
export function deriveStreakDays(lastProgressDate: string | undefined, streakCount: number): number {
    if (!lastProgressDate) return 0;
    const lastDate = new Date(lastProgressDate + 'T00:00:00');
    const today = new Date(todayDateString() + 'T00:00:00');
    const diffDays = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
    if (diffDays === 0) return Math.max(streakCount, 1);
    if (diffDays === 1) return streakCount + 1;
    return 0;
}

/**
 * Compute updated streak when marking a surah complete.
 */
export function computeNewStreak(lastProgressDate: string | undefined, currentStreak: number): number {
    if (!lastProgressDate) return 1;
    const today = todayDateString();
    const lastDate = new Date(lastProgressDate + 'T00:00:00');
    const todayDate = new Date(today + 'T00:00:00');
    const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / 86400000);
    if (diffDays === 0) return Math.max(currentStreak, 1);
    if (diffDays === 1) return currentStreak + 1;
    return 1;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

const getStorageKey = (year: number) => `${STORAGE_KEY}_${year}`;

export function initialState(year: number): KhatmaState {
    return {
        completedSurahs: [],
        year,
        currentRound: 1,
        completedRounds: [],
        streakCount: 0,
    };
}

export async function loadProgress(year: number, userId?: string | null): Promise<KhatmaState> {
    try {
        const key = getStorageKey(year);
        const raw = userId
            ? await UserScopedStorage.getItem(key, userId)
            : await AsyncStorage.getItem(key);
        if (!raw) return initialState(year);

        const parsed = JSON.parse(raw);

        // Migration: old format had completedJuz, new format has completedSurahs
        if (Array.isArray(parsed.completedJuz) && !Array.isArray(parsed.completedSurahs)) {
            const juzNumbers = parsed.completedJuz as number[];
            let highestSurah = 0;
            for (const juzNum of juzNumbers) {
                const juz = JUZ_DATA.find(j => j.juzNumber === juzNum);
                if (juz && juz.endSurahNumber > highestSurah) {
                    highestSurah = juz.endSurahNumber;
                }
            }
            const migratedSurahs = Array.from({ length: highestSurah }, (_, i) => i + 1);
            const migratedState: KhatmaState = {
                completedSurahs: migratedSurahs,
                year: parsed.year || year,
                lastProgressDate: parsed.lastProgressDate,
                currentRound: parsed.currentRound || 1,
                completedRounds: parsed.completedRounds || [],
                streakCount: parsed.streakCount || 0,
            };
            await saveProgress(migratedState, userId);
            return migratedState;
        }

        if (Array.isArray(parsed.completedSurahs)) {
            return {
                completedSurahs: parsed.completedSurahs.filter(
                    (n: number, i: number, arr: number[]) =>
                        typeof n === 'number' && n >= 1 && n <= 114 && arr.indexOf(n) === i
                ),
                year: parsed.year || year,
                lastProgressDate: parsed.lastProgressDate,
                currentRound: parsed.currentRound || 1,
                completedRounds: parsed.completedRounds || [],
                streakCount: parsed.streakCount || 0,
            };
        }

        return initialState(year);
    } catch (e) {
        if (__DEV__) console.error('[KhatmaService] Load failed:', e);
        return initialState(year);
    }
}

export async function saveProgress(state: KhatmaState, userId?: string | null): Promise<void> {
    try {
        const key = getStorageKey(state.year);
        if (userId) {
            await UserScopedStorage.setItem(key, userId, JSON.stringify(state));
        } else {
            await AsyncStorage.setItem(key, JSON.stringify(state));
        }
    } catch (e) {
        if (__DEV__) console.error('[KhatmaService] Save failed:', e);
    }
}
