import { Surah } from './Quran';

export interface SurahMetadata {
    pageRange: string;     // e.g., "1-3" or "604"
    juzList: number[];     // e.g., [1] or [29, 30]
    estimatedMinutes: number; // Based on ~1.2 min per page
    startPage: number;
    endPage: number;
}

/**
 * Derive metadata from loaded surah verses.
 * This avoids any additional API calls — computed entirely from data we already have.
 * 
 * Duration estimation uses the scholarly standard of ~1 page per 1.2 minutes
 * for moderate-paced Quran recitation.
 */
export function computeSurahMetadata(surah: Surah): SurahMetadata {
    if (!surah.verses || surah.verses.length === 0) {
        return {
            pageRange: '—',
            juzList: [],
            estimatedMinutes: 0,
            startPage: 0,
            endPage: 0,
        };
    }

    const pages = surah.verses.map(v => v.page);
    const juzSet = new Set(surah.verses.map(v => v.juz));

    const startPage = Math.min(...pages);
    const endPage = Math.max(...pages);
    const totalPages = endPage - startPage + 1;

    // ~1.2 minutes per page for moderate recitation speed
    const estimatedMinutes = Math.round(totalPages * 1.2);

    const juzList = Array.from(juzSet).sort((a, b) => a - b);

    return {
        pageRange: startPage === endPage ? `${startPage}` : `${startPage}–${endPage}`,
        juzList,
        estimatedMinutes,
        startPage,
        endPage,
    };
}

/**
 * Format juz list for display.
 * e.g., [1] → "Juz 1", [29, 30] → "Juz 29–30", [1,2,3] → "Juz 1–3"
 */
export function formatJuzDisplay(juzList: number[]): string {
    if (juzList.length === 0) return '—';
    if (juzList.length === 1) return `Juz ${juzList[0]}`;
    return `Juz ${juzList[0]}–${juzList[juzList.length - 1]}`;
}

/**
 * Format duration for display.
 * e.g., 3 → "3 min", 65 → "1h 5m"
 */
export function formatDuration(minutes: number): string {
    if (minutes <= 0) return '—';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
