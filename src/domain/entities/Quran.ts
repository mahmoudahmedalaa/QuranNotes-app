export interface Verse {
    number: number; // Verse number in surah
    text: string; // Arabic Uthmani
    translation: string; // English
    surahNumber: number;
    juz: number;
    page: number;
}

export interface Surah {
    number: number;
    name: string; // Arabic name
    englishName: string;
    englishNameTranslation: string;
    numberOfAyahs: number;
    revelationType: 'Meccan' | 'Medinan';
    verses: Verse[];
}
