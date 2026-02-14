/**
 * Ramadan 2026 date utilities
 * Pure functions — no mutable state. Debug flag is passed from React context.
 *
 * Dates are initialized from Firestore via RamadanConfigService on app launch,
 * then kept in sync via real-time listener (onSnapshot).
 * If Firestore is unavailable, hardcoded defaults are used.
 */
import { RamadanConfigService } from '../infrastructure/config/RamadanConfigService';

// ── Mutable dates — updated by initRamadanDates() and live listener ──
let ramadanStart = new Date('2026-02-18T00:00:00');
let ramadanEnd = new Date('2026-03-19T23:59:59');

/**
 * Apply new dates from Firestore (used by both initial fetch and live updates).
 */
function applyDates(startDate: string, endDate: string) {
    ramadanStart = new Date(`${startDate}T00:00:00`);
    ramadanEnd = new Date(`${endDate}T23:59:59`);
    console.log(`[Ramadan] Dates applied: ${startDate} → ${endDate}`);
}

/**
 * Initialize Ramadan dates from Firestore + start real-time listener.
 * Call once on app launch. Returns unsubscribe function for cleanup.
 */
export async function initRamadanDates(): Promise<() => void> {
    // Register callback for live updates
    RamadanConfigService.setOnDatesChanged((dates) => {
        applyDates(dates.startDate, dates.endDate);
    });

    // Initial fetch (with cache fallback)
    try {
        const dates = await RamadanConfigService.fetch();
        applyDates(dates.startDate, dates.endDate);
    } catch (e) {
        console.log('[Ramadan] Using hardcoded defaults');
    }

    // Start real-time listener — updates propagate instantly
    const unsubscribe = RamadanConfigService.listen();
    return unsubscribe;
}

/**
 * Check if current date falls within Ramadan 2026
 */
export function isRamadan(debugOverride?: boolean): boolean {
    if (debugOverride) return true;
    const now = new Date();
    return now >= ramadanStart && now <= ramadanEnd;
}

/**
 * Check if we're in the Ramadan promotional season
 * Starts 2 weeks before Ramadan for early promo, ends with Ramadan
 * Used for paywall to show the Ramadan special pricing
 */
export function isRamadanSeason(): boolean {
    const now = new Date();
    const promoStart = new Date(ramadanStart);
    promoStart.setDate(promoStart.getDate() - 14); // 2 weeks before Ramadan
    return now >= promoStart && now <= ramadanEnd;
}

/** True during the 3-day Eid window right after Ramadan */
export function isPostRamadan(): boolean {
    const now = new Date();
    const eidEnd = new Date(ramadanEnd);
    eidEnd.setDate(eidEnd.getDate() + 3);
    return now > ramadanEnd && now <= eidEnd;
}

/** True once Ramadan has permanently ended (past last day) */
export function isRamadanEnded(): boolean {
    return new Date() > ramadanEnd;
}

/**
 * Get current day of Ramadan (1-30, or 0 if not Ramadan)
 */
export function currentRamadanDay(debugOverride?: boolean, debugDay?: number): number {
    if (debugOverride) return debugDay ?? 5;
    const now = new Date();
    if (!isRamadan()) return 0;
    const diff = now.getTime() - ramadanStart.getTime();
    return Math.min(30, Math.floor(diff / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Days until Ramadan starts (for countdown)
 */
export function daysUntilRamadan(): number {
    const now = new Date();
    const diff = ramadanStart.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/**
 * Get number of days remaining until Ramadan ends
 */
export function daysUntilRamadanEnds(debugOverride?: boolean, debugDay?: number): number {
    if (debugOverride) return 30 - (debugDay ?? 5);
    const now = new Date();
    const diff = ramadanEnd.getTime() - now.getTime();
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
