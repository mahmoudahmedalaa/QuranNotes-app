/**
 * Ramadan 2026 date utilities
 * Pure functions — no mutable state. Debug flag is passed from React context.
 */

// Ramadan 2026 actual dates
export const RAMADAN_2026_START = new Date('2026-02-18T00:00:00');
export const RAMADAN_2026_END = new Date('2026-03-19T23:59:59');

/**
 * Check if current date falls within Ramadan 2026
 */
export function isRamadan(debugOverride?: boolean): boolean {
    if (debugOverride) return true;
    const now = new Date();
    return now >= RAMADAN_2026_START && now <= RAMADAN_2026_END;
}

/**
 * Check if we're in the Ramadan promotional season
 * Starts 2 weeks before Ramadan for early promo, ends with Ramadan
 * Used for paywall to show the Ramadan special pricing
 */
export function isRamadanSeason(): boolean {
    const now = new Date();
    const promoStart = new Date(RAMADAN_2026_START);
    promoStart.setDate(promoStart.getDate() - 14); // 2 weeks before Ramadan
    return now >= promoStart && now <= RAMADAN_2026_END;
}

/** True during the 3-day Eid window right after Ramadan */
export function isPostRamadan(): boolean {
    const now = new Date();
    const eidEnd = new Date(RAMADAN_2026_END);
    eidEnd.setDate(eidEnd.getDate() + 3);
    return now > RAMADAN_2026_END && now <= eidEnd;
}

/** True once Ramadan has permanently ended (past last day) */
export function isRamadanEnded(): boolean {
    return new Date() > RAMADAN_2026_END;
}

/**
 * Get current day of Ramadan (1-30, or 0 if not Ramadan)
 */
export function currentRamadanDay(debugOverride?: boolean, debugDay?: number): number {
    if (debugOverride) return debugDay ?? 5;
    const now = new Date();
    if (!isRamadan()) return 0;
    const diff = now.getTime() - RAMADAN_2026_START.getTime();
    return Math.min(30, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Days until Ramadan starts (for countdown)
 */
export function daysUntilRamadan(): number {
    const now = new Date();
    const diff = RAMADAN_2026_START.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get number of days remaining until Ramadan ends
 */
export function daysUntilRamadanEnds(debugOverride?: boolean, debugDay?: number): number {
    if (debugOverride) return 30 - (debugDay ?? 5);
    const now = new Date();
    const diff = RAMADAN_2026_END.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Format countdown string
 */
export function ramadanCountdownText(debugOverride?: boolean, debugDay?: number): string {
    if (debugOverride) {
        const daysLeft = 30 - (debugDay ?? 5);
        if (daysLeft === 0) return 'Last day!';
        if (daysLeft === 1) return '1 day left';
        return `${daysLeft} days left`;
    }
    if (!isRamadan()) {
        const days = daysUntilRamadan();
        if (days === 0) return 'Ramadan begins today!';
        if (days === 1) return '1 day until Ramadan';
        return `${days} days until Ramadan`;
    }
    const days = daysUntilRamadanEnds();
    if (days === 0) return 'Last day!';
    if (days === 1) return '1 day left';
    return `${days} days left`;
}
