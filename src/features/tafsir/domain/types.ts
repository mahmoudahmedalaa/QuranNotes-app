/**
 * Tafsir Feature — Domain Types
 * 
 * Core type definitions for the Tafsir & AI Q&A feature.
 */

/** Supported tafsir commentary sources */
export type TafsirSource = 'ibn_kathir' | 'al_sadi';

/** Display names for tafsir sources */
export const TAFSIR_SOURCE_LABELS: Record<TafsirSource, string> = {
    ibn_kathir: 'Ibn Kathir',
    al_sadi: 'Al-Sa\'di',
};

/** Default tafsir source */
export const DEFAULT_TAFSIR_SOURCE: TafsirSource = 'ibn_kathir';

/** Result from loading tafsir commentary */
export interface TafsirCommentary {
    /** The raw commentary text */
    text: string;
    /** Which tafsir source this came from */
    source: TafsirSource;
    /** Surah number (1-114) */
    surahNumber: number;
    /** Verse number within the surah */
    verseNumber: number;
    /** Verse range this commentary covers, e.g. [1, 7] */
    verseRange?: [number, number];
}

/** Result from an AI query about a verse */
export interface AiQueryResult {
    /** The AI-generated answer */
    answer: string;
    /** Whether this came from cache */
    cached: boolean;
    status: import('../../noor-ai/domain/generatedContract').NoorStatus;
    citations: import('../../noor-ai/domain/generatedContract').NoorCitation[];
    requestId: string;
    nextResetAt?: string;
}

/** Props for the TafsirBottomSheet component */
export interface TafsirSheetData {
    /** Arabic text of the verse */
    arabicText: string;
    /** English translation of the verse */
    translation: string;
    /** Name of the surah (e.g., "Al-Fatiha") */
    surahName: string;
    /** Verse number within the surah */
    verseNumber: number;
    /** Surah number (1-114) */
    surahNumber: number;
}
