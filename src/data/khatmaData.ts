/**
 * Khatma (Quran Completion) Data
 * Complete 30-Juz mapping with Surah ranges, page ranges, and helper functions.
 */

export interface JuzInfo {
    juzNumber: number;
    startSurah: string;
    startSurahArabic: string;
    startSurahNumber: number;
    startVerseNumber: number;  // First verse of this Juz within startSurah
    endSurah: string;
    endSurahArabic: string;
    endSurahNumber: number;
    endVerseNumber: number;    // Last verse of this Juz within endSurah
    startPage: number;
    endPage: number;
    totalPages: number;
}

/**
 * Complete 30-Juz mapping
 * Based on the standard Mushaf (Medina print)
 */
export const JUZ_DATA: JuzInfo[] = [
    { juzNumber: 1, startSurah: 'Al-Fatiha', startSurahArabic: 'الفاتحة', startSurahNumber: 1, startVerseNumber: 1, endSurah: 'Al-Baqarah', endSurahArabic: 'البقرة', endSurahNumber: 2, endVerseNumber: 141, startPage: 1, endPage: 21, totalPages: 21 },
    { juzNumber: 2, startSurah: 'Al-Baqarah', startSurahArabic: 'البقرة', startSurahNumber: 2, startVerseNumber: 142, endSurah: 'Al-Baqarah', endSurahArabic: 'البقرة', endSurahNumber: 2, endVerseNumber: 252, startPage: 22, endPage: 41, totalPages: 20 },
    { juzNumber: 3, startSurah: 'Al-Baqarah', startSurahArabic: 'البقرة', startSurahNumber: 2, startVerseNumber: 253, endSurah: 'Al-Imran', endSurahArabic: 'آل عمران', endSurahNumber: 3, endVerseNumber: 92, startPage: 42, endPage: 61, totalPages: 20 },
    { juzNumber: 4, startSurah: 'Al-Imran', startSurahArabic: 'آل عمران', startSurahNumber: 3, startVerseNumber: 93, endSurah: 'An-Nisa', endSurahArabic: 'النساء', endSurahNumber: 4, endVerseNumber: 23, startPage: 62, endPage: 81, totalPages: 20 },
    { juzNumber: 5, startSurah: 'An-Nisa', startSurahArabic: 'النساء', startSurahNumber: 4, startVerseNumber: 24, endSurah: 'An-Nisa', endSurahArabic: 'النساء', endSurahNumber: 4, endVerseNumber: 147, startPage: 82, endPage: 101, totalPages: 20 },
    { juzNumber: 6, startSurah: 'An-Nisa', startSurahArabic: 'النساء', startSurahNumber: 4, startVerseNumber: 148, endSurah: "Al-Ma'idah", endSurahArabic: 'المائدة', endSurahNumber: 5, endVerseNumber: 81, startPage: 102, endPage: 121, totalPages: 20 },
    { juzNumber: 7, startSurah: "Al-Ma'idah", startSurahArabic: 'المائدة', startSurahNumber: 5, startVerseNumber: 82, endSurah: "Al-An'am", endSurahArabic: 'الأنعام', endSurahNumber: 6, endVerseNumber: 110, startPage: 122, endPage: 141, totalPages: 20 },
    { juzNumber: 8, startSurah: "Al-An'am", startSurahArabic: 'الأنعام', startSurahNumber: 6, startVerseNumber: 111, endSurah: "Al-A'raf", endSurahArabic: 'الأعراف', endSurahNumber: 7, endVerseNumber: 87, startPage: 142, endPage: 161, totalPages: 20 },
    { juzNumber: 9, startSurah: "Al-A'raf", startSurahArabic: 'الأعراف', startSurahNumber: 7, startVerseNumber: 88, endSurah: 'Al-Anfal', endSurahArabic: 'الأنفال', endSurahNumber: 8, endVerseNumber: 40, startPage: 162, endPage: 181, totalPages: 20 },
    { juzNumber: 10, startSurah: 'Al-Anfal', startSurahArabic: 'الأنفال', startSurahNumber: 8, startVerseNumber: 41, endSurah: 'At-Tawbah', endSurahArabic: 'التوبة', endSurahNumber: 9, endVerseNumber: 92, startPage: 182, endPage: 201, totalPages: 20 },
    { juzNumber: 11, startSurah: 'At-Tawbah', startSurahArabic: 'التوبة', startSurahNumber: 9, startVerseNumber: 93, endSurah: 'Hud', endSurahArabic: 'هود', endSurahNumber: 11, endVerseNumber: 5, startPage: 202, endPage: 221, totalPages: 20 },
    { juzNumber: 12, startSurah: 'Hud', startSurahArabic: 'هود', startSurahNumber: 11, startVerseNumber: 6, endSurah: 'Yusuf', endSurahArabic: 'يوسف', endSurahNumber: 12, endVerseNumber: 52, startPage: 222, endPage: 241, totalPages: 20 },
    { juzNumber: 13, startSurah: 'Yusuf', startSurahArabic: 'يوسف', startSurahNumber: 12, startVerseNumber: 53, endSurah: 'Ibrahim', endSurahArabic: 'إبراهيم', endSurahNumber: 14, endVerseNumber: 52, startPage: 242, endPage: 261, totalPages: 20 },
    { juzNumber: 14, startSurah: 'Al-Hijr', startSurahArabic: 'الحجر', startSurahNumber: 15, startVerseNumber: 1, endSurah: 'An-Nahl', endSurahArabic: 'النحل', endSurahNumber: 16, endVerseNumber: 128, startPage: 262, endPage: 281, totalPages: 20 },
    { juzNumber: 15, startSurah: 'Al-Isra', startSurahArabic: 'الإسراء', startSurahNumber: 17, startVerseNumber: 1, endSurah: 'Al-Kahf', endSurahArabic: 'الكهف', endSurahNumber: 18, endVerseNumber: 74, startPage: 282, endPage: 301, totalPages: 20 },
    { juzNumber: 16, startSurah: 'Al-Kahf', startSurahArabic: 'الكهف', startSurahNumber: 18, startVerseNumber: 75, endSurah: 'Ta-Ha', endSurahArabic: 'طه', endSurahNumber: 20, endVerseNumber: 135, startPage: 302, endPage: 321, totalPages: 20 },
    { juzNumber: 17, startSurah: 'Al-Anbiya', startSurahArabic: 'الأنبياء', startSurahNumber: 21, startVerseNumber: 1, endSurah: 'Al-Hajj', endSurahArabic: 'الحج', endSurahNumber: 22, endVerseNumber: 78, startPage: 322, endPage: 341, totalPages: 20 },
    { juzNumber: 18, startSurah: "Al-Mu'minun", startSurahArabic: 'المؤمنون', startSurahNumber: 23, startVerseNumber: 1, endSurah: 'Al-Furqan', endSurahArabic: 'الفرقان', endSurahNumber: 25, endVerseNumber: 20, startPage: 342, endPage: 361, totalPages: 20 },
    { juzNumber: 19, startSurah: 'Al-Furqan', startSurahArabic: 'الفرقان', startSurahNumber: 25, startVerseNumber: 21, endSurah: 'An-Naml', endSurahArabic: 'النمل', endSurahNumber: 27, endVerseNumber: 55, startPage: 362, endPage: 381, totalPages: 20 },
    { juzNumber: 20, startSurah: 'An-Naml', startSurahArabic: 'النمل', startSurahNumber: 27, startVerseNumber: 56, endSurah: 'Al-Ankabut', endSurahArabic: 'العنكبوت', endSurahNumber: 29, endVerseNumber: 45, startPage: 382, endPage: 401, totalPages: 20 },
    { juzNumber: 21, startSurah: 'Al-Ankabut', startSurahArabic: 'العنكبوت', startSurahNumber: 29, startVerseNumber: 46, endSurah: 'Al-Ahzab', endSurahArabic: 'الأحزاب', endSurahNumber: 33, endVerseNumber: 30, startPage: 402, endPage: 421, totalPages: 20 },
    { juzNumber: 22, startSurah: 'Al-Ahzab', startSurahArabic: 'الأحزاب', startSurahNumber: 33, startVerseNumber: 31, endSurah: 'Ya-Sin', endSurahArabic: 'يس', endSurahNumber: 36, endVerseNumber: 27, startPage: 422, endPage: 441, totalPages: 20 },
    { juzNumber: 23, startSurah: 'Ya-Sin', startSurahArabic: 'يس', startSurahNumber: 36, startVerseNumber: 28, endSurah: 'Az-Zumar', endSurahArabic: 'الزمر', endSurahNumber: 39, endVerseNumber: 31, startPage: 442, endPage: 461, totalPages: 20 },
    { juzNumber: 24, startSurah: 'Az-Zumar', startSurahArabic: 'الزمر', startSurahNumber: 39, startVerseNumber: 32, endSurah: 'Fussilat', endSurahArabic: 'فصلت', endSurahNumber: 41, endVerseNumber: 46, startPage: 462, endPage: 481, totalPages: 20 },
    { juzNumber: 25, startSurah: 'Fussilat', startSurahArabic: 'فصلت', startSurahNumber: 41, startVerseNumber: 47, endSurah: 'Al-Jathiyah', endSurahArabic: 'الجاثية', endSurahNumber: 45, endVerseNumber: 37, startPage: 482, endPage: 501, totalPages: 20 },
    { juzNumber: 26, startSurah: 'Al-Ahqaf', startSurahArabic: 'الأحقاف', startSurahNumber: 46, startVerseNumber: 1, endSurah: 'Adh-Dhariyat', endSurahArabic: 'الذاريات', endSurahNumber: 51, endVerseNumber: 30, startPage: 502, endPage: 521, totalPages: 20 },
    { juzNumber: 27, startSurah: 'Adh-Dhariyat', startSurahArabic: 'الذاريات', startSurahNumber: 51, startVerseNumber: 31, endSurah: 'Al-Hadid', endSurahArabic: 'الحديد', endSurahNumber: 57, endVerseNumber: 29, startPage: 522, endPage: 541, totalPages: 20 },
    { juzNumber: 28, startSurah: 'Al-Mujadila', startSurahArabic: 'المجادلة', startSurahNumber: 58, startVerseNumber: 1, endSurah: 'At-Tahrim', endSurahArabic: 'التحريم', endSurahNumber: 66, endVerseNumber: 12, startPage: 542, endPage: 561, totalPages: 20 },
    { juzNumber: 29, startSurah: 'Al-Mulk', startSurahArabic: 'الملك', startSurahNumber: 67, startVerseNumber: 1, endSurah: 'Al-Mursalat', endSurahArabic: 'المرسلات', endSurahNumber: 77, endVerseNumber: 50, startPage: 562, endPage: 581, totalPages: 20 },
    { juzNumber: 30, startSurah: 'An-Naba', startSurahArabic: 'النبأ', startSurahNumber: 78, startVerseNumber: 1, endSurah: 'An-Nas', endSurahArabic: 'الناس', endSurahNumber: 114, endVerseNumber: 6, startPage: 582, endPage: 604, totalPages: 23 },
];

/**
 * Get info for a specific Juz
 */
export function getJuzInfo(juzNumber: number): JuzInfo | undefined {
    return JUZ_DATA.find(j => j.juzNumber === juzNumber);
}

/**
 * Get the Juz assigned to a specific day (1-indexed)
 * Day 1 = Juz 1, Day 2 = Juz 2, etc.
 */
export function getJuzForDay(day: number): JuzInfo | undefined {
    if (day < 1 || day > 30) return undefined;
    return JUZ_DATA[day - 1];
}

/**
 * Calculate dynamic daily target based on progress
 * @param completedJuz - Array of completed Juz numbers
 * @param currentDay - The current "khatma day" (may be recalibrated for multi-round)
 * @param actualRamadanDay - Optional: the real Ramadan day (used for remaining-days calc in multi-round)
 */
export function calculateDailyTarget(
    completedJuz: number[],
    currentDay: number,
    actualRamadanDay?: number,
): {
    remainingJuz: number;
    remainingDays: number;
    dailyTarget: number;
    isAhead: boolean;
    isBehind: boolean;
    message: string;
} {
    const totalJuz = 30;
    const completed = completedJuz.length;
    const remainingJuz = totalJuz - completed;
    // Use actual Ramadan day for "how many days left" when provided (multi-round)
    const dayForRemaining = actualRamadanDay ?? currentDay;
    const remainingDays = Math.max(1, 30 - dayForRemaining + 1);
    const dailyTarget = remainingJuz / remainingDays;
    const expectedByNow = currentDay;
    const isAhead = completed > expectedByNow;
    const isBehind = completed < expectedByNow;

    let message: string;
    if (completed >= 30) {
        message = "ما شاء الله — You've completed the entire Quran! 🎉";
    } else if (isAhead) {
        const aheadBy = completed - expectedByNow;
        message = `You're ${aheadBy} Juz ahead! Keep the momentum 🔥`;
    } else if (isBehind) {
        if (dailyTarget <= 1.5) {
            message = `Read ${dailyTarget.toFixed(1)} Juz/day to finish by Eid 💪`;
        } else if (dailyTarget <= 2) {
            message = `${remainingJuz} Juz left in ${remainingDays} days — you can do it 📖`;
        } else {
            message = `Focus on what you can. Every page counts 🤲`;
        }
    } else {
        message = "Right on track! Keep going 🌙";
    }

    return { remainingJuz, remainingDays, dailyTarget, isAhead, isBehind, message };
}

/**
 * Get total pages read based on completed Juz
 */
export function getTotalPagesRead(completedJuz: number[]): number {
    return completedJuz.reduce((total, juzNum) => {
        const juz = getJuzInfo(juzNum);
        return total + (juz?.totalPages ?? 0);
    }, 0);
}

/**
 * Get which Juz a page belongs to (1-based page number)
 */
export function getJuzForPage(pageNumber: number): number | undefined {
    const juz = JUZ_DATA.find(j => pageNumber >= j.startPage && pageNumber <= j.endPage);
    return juz?.juzNumber;
}

/**
 * Get which Juz(s) a surah belongs to (surah can span multiple Juz)
 */
export function getJuzForSurah(surahNumber: number): number[] {
    return JUZ_DATA
        .filter(j => surahNumber >= j.startSurahNumber && surahNumber <= j.endSurahNumber)
        .map(j => j.juzNumber);
}

/**
 * Check if a page belongs to a specific Juz
 */
export function isPageInJuz(pageNumber: number, juzNumber: number): boolean {
    const juz = JUZ_DATA.find(j => j.juzNumber === juzNumber);
    if (!juz) return false;
    return pageNumber >= juz.startPage && pageNumber <= juz.endPage;
}

/**
 * Get all pages in a Juz as an array [startPage..endPage]
 */
export function getPagesInJuz(juzNumber: number): number[] {
    const juz = JUZ_DATA.find(j => j.juzNumber === juzNumber);
    if (!juz) return [];
    return Array.from({ length: juz.totalPages }, (_, i) => juz.startPage + i);
}

/**
 * Motivational daily messages for the Khatma header
 */
export const DAILY_MESSAGES = [
    { arabic: 'بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', english: 'In the name of Allah, the Most Gracious, the Most Merciful' },
    { arabic: 'وَرَتِّلِ الْقُرْآنَ تَرْتِيلًا', english: 'And recite the Quran with measured recitation' },
    { arabic: 'شَهْرُ رَمَضَانَ الَّذِي أُنزِلَ فِيهِ الْقُرْآنُ', english: 'Ramadan — the month in which the Quran was revealed' },
    { arabic: 'إِنَّ هَذَا الْقُرْآنَ يَهْدِي لِلَّتِي هِيَ أَقْوَمُ', english: 'This Quran guides to what is most upright' },
    { arabic: 'اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ', english: 'Read in the name of your Lord who created' },
    { arabic: 'وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ', english: 'And We have made the Quran easy for remembrance' },
    { arabic: 'فَاذْكُرُونِي أَذْكُرْكُمْ', english: 'Remember Me, and I will remember you' },
    { arabic: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', english: 'Indeed, with hardship comes ease' },
];

/**
 * Get today's motivational message (cycles through the list)
 */
export function getDailyMessage(day: number): { arabic: string; english: string } {
    const index = (day - 1) % DAILY_MESSAGES.length;
    return DAILY_MESSAGES[index];
}
