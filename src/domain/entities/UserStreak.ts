export interface UserStreak {
    currentStreak: number;
    longestStreak: number;
    lastReflectionDate: string | null; // ISO Date string (YYYY-MM-DD)
    totalReflections: number;
    activityHistory: Record<string, number>; // Date string -> Reflection count
}

export const INITIAL_STREAK: UserStreak = {
    currentStreak: 0,
    longestStreak: 0,
    lastReflectionDate: null,
    totalReflections: 0,
    activityHistory: {},
};
