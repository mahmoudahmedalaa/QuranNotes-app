/**
 * Ramadan 2026 date utilities
 * Provides helpers for date-gating Ramadan features
 */

// Ramadan 2026 promo period (starts early for pre-Ramadan buzz)
export const RAMADAN_2026_START = new Date('2026-02-12T00:00:00');
export const RAMADAN_2026_END = new Date('2026-03-19T23:59:59');

/**
 * Check if current date falls within Ramadan 2026
 */
export function isRamadan(): boolean {
    const now = new Date();
    return now >= RAMADAN_2026_START && now <= RAMADAN_2026_END;
}

/**
 * Get number of days remaining until Ramadan ends
 */
export function daysUntilRamadanEnds(): number {
    const now = new Date();
    const diff = RAMADAN_2026_END.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get current day of Ramadan (1-30)
 */
export function currentRamadanDay(): number {
    const now = new Date();
    if (!isRamadan()) return 0;
    const diff = now.getTime() - RAMADAN_2026_START.getTime();
    return Math.min(30, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Format countdown string: "X days left"
 */
export function ramadanCountdownText(): string {
    const days = daysUntilRamadanEnds();
    if (days === 0) return 'Last day!';
    if (days === 1) return '1 day left';
    return `${days} days left`;
}
