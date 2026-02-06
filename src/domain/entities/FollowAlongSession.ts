/**
 * FollowAlongSession Entity
 * Represents a recitation tracking session where the app follows along
 * with the user's Quran recitation and tracks which verses were recited.
 */
export interface FollowAlongSession {
    id: string;
    surahId: number;
    surahName: string;
    surahNameArabic: string;
    startedAt: Date;
    endedAt: Date;
    versesRecited: number[]; // Array of verse numbers that were detected
    totalVerses: number;
    accuracyPercentage: number; // 0-100
    durationSeconds: number;
}

/**
 * Create a new FollowAlongSession with default values
 */
export function createFollowAlongSession(
    surahId: number,
    surahName: string,
    surahNameArabic: string,
    totalVerses: number
): Omit<FollowAlongSession, 'id' | 'endedAt' | 'accuracyPercentage' | 'durationSeconds'> {
    return {
        surahId,
        surahName,
        surahNameArabic,
        startedAt: new Date(),
        versesRecited: [],
        totalVerses,
    };
}

/**
 * Calculate accuracy percentage for a session
 */
export function calculateSessionAccuracy(
    versesRecited: number[],
    totalVerses: number
): number {
    if (totalVerses === 0) return 0;
    const uniqueVerses = [...new Set(versesRecited)];
    return Math.round((uniqueVerses.length / totalVerses) * 100);
}

/**
 * Calculate duration in seconds between two dates
 */
export function calculateSessionDuration(startedAt: Date, endedAt: Date): number {
    return Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
}
