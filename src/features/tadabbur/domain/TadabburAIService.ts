/**
 * Tadabbur content service.
 *
 * Tadabbur is intentionally reliable offline. Verse selection and reflection
 * prompts come from a curated, validated Quran set so starting a session never
 * depends on a client-side model, a remote API, or an exposed provider key.
 * Governed AI questions remain available through the Noor/Tafsir services.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
    ReflectionIntent,
    VerseSelection,
    ReflectionPrompt,
    IntentCategory,
} from './entities/Reflection';
import { DEFAULT_INTENTS } from './entities/Reflection';

const CACHE_PREFIX = 'tadabbur_curated_v1_';
const INTENT_HISTORY_KEY = 'tadabbur_intent_history';
const VERSE_HISTORY_KEY = 'tadabbur_verse_history';
const MAX_INTENT_HISTORY = 20;
const MAX_VERSE_HISTORY = 50;

// ── Curated verse sets ─────────────────────────────────────────────────────

const FALLBACK_VERSES: Record<IntentCategory, VerseSelection[]> = {
    patience: [
        { surahNumber: 2, startVerse: 153, endVerse: 155, reason: 'Classic ayat on patience and perseverance through trials.' },
        { surahNumber: 39, startVerse: 10, endVerse: 10, reason: 'The reward of those who are patient is given without measure.' },
        { surahNumber: 3, startVerse: 186, endVerse: 186, reason: 'You will surely be tested in your possessions and in yourselves.' },
    ],
    gratitude: [
        { surahNumber: 14, startVerse: 7, endVerse: 7, reason: 'If you are grateful, I will surely increase you.' },
        { surahNumber: 55, startVerse: 1, endVerse: 4, reason: "A beautiful enumeration of Allah's countless blessings." },
        { surahNumber: 31, startVerse: 12, endVerse: 14, reason: "Luqman's wisdom on gratitude to Allah and parents." },
    ],
    hope: [
        { surahNumber: 39, startVerse: 53, endVerse: 53, reason: 'Do not despair of the mercy of Allah — He forgives all sins.' },
        { surahNumber: 94, startVerse: 5, endVerse: 6, reason: 'With hardship comes ease — repeated for emphasis.' },
        { surahNumber: 12, startVerse: 87, endVerse: 87, reason: 'Do not despair of relief from Allah — only disbelievers despair.' },
    ],
    repentance: [
        { surahNumber: 39, startVerse: 53, endVerse: 54, reason: 'Allah forgives all sins — turn to Him before it is too late.' },
        { surahNumber: 3, startVerse: 135, endVerse: 136, reason: 'Those who remember Allah and seek forgiveness for their sins.' },
        { surahNumber: 66, startVerse: 8, endVerse: 8, reason: 'Turn to Allah with sincere repentance (tawbah nasuha).' },
    ],
    trust: [
        { surahNumber: 65, startVerse: 2, endVerse: 3, reason: 'Whoever relies upon Allah — He is sufficient for him.' },
        { surahNumber: 3, startVerse: 159, endVerse: 159, reason: 'When you have decided, put your trust in Allah.' },
        { surahNumber: 8, startVerse: 2, endVerse: 4, reason: 'The believers are those whose hearts tremble when Allah is mentioned.' },
    ],
    guidance: [
        { surahNumber: 1, startVerse: 1, endVerse: 5, reason: 'Al-Fatiha — the opening supplication for guidance.' },
        { surahNumber: 2, startVerse: 2, endVerse: 4, reason: 'This Book has no doubt — guidance for the righteous.' },
        { surahNumber: 17, startVerse: 9, endVerse: 9, reason: 'This Quran guides to the straightest path.' },
    ],
    remembrance: [
        { surahNumber: 13, startVerse: 28, endVerse: 28, reason: 'By the remembrance of Allah do hearts find rest.' },
        { surahNumber: 33, startVerse: 41, endVerse: 42, reason: 'Remember Allah with much remembrance.' },
        { surahNumber: 2, startVerse: 152, endVerse: 152, reason: 'Remember Me, and I will remember you.' },
    ],
    custom: [
        { surahNumber: 2, startVerse: 286, endVerse: 286, reason: 'A comprehensive supplication — Allah does not burden a soul beyond its capacity.' },
        { surahNumber: 3, startVerse: 190, endVerse: 191, reason: 'Signs of creation for those who reflect.' },
        { surahNumber: 59, startVerse: 22, endVerse: 24, reason: 'The beautiful names of Allah — a meditation on His attributes.' },
    ],
    fear: [
        { surahNumber: 10, startVerse: 62, endVerse: 64, reason: 'For the allies of Allah there is no fear, nor shall they grieve.' },
        { surahNumber: 2, startVerse: 286, endVerse: 286, reason: 'Allah does not burden a soul beyond its capacity.' },
        { surahNumber: 9, startVerse: 51, endVerse: 51, reason: 'Nothing will befall us except what Allah has decreed for us.' },
    ],
    comfort: [
        { surahNumber: 93, startVerse: 1, endVerse: 5, reason: 'Surah Ad-Duha — Allah has not forsaken you, a message of divine comfort.' },
        { surahNumber: 94, startVerse: 1, endVerse: 5, reason: 'Surah Ash-Sharh — with every hardship comes ease.' },
        { surahNumber: 65, startVerse: 2, endVerse: 3, reason: 'Whoever fears Allah, He will make a way out for them.' },
    ],
    knowledge: [
        { surahNumber: 96, startVerse: 1, endVerse: 5, reason: 'The first revelation — Read! Your Lord taught by the pen.' },
        { surahNumber: 20, startVerse: 114, endVerse: 114, reason: 'Say: My Lord, increase me in knowledge.' },
        { surahNumber: 58, startVerse: 11, endVerse: 11, reason: 'Allah will raise those who have been given knowledge by degrees.' },
    ],
    loneliness: [
        { surahNumber: 2, startVerse: 186, endVerse: 186, reason: 'I am near — I respond to the call of the caller when he calls upon Me.' },
        { surahNumber: 57, startVerse: 4, endVerse: 4, reason: "He is with you wherever you are — a reminder of Allah's constant closeness." },
        { surahNumber: 93, startVerse: 1, endVerse: 5, reason: 'Your Lord has not forsaken you, nor has He become displeased — divine companionship.' },
    ],
    general: [
        { surahNumber: 2, startVerse: 255, endVerse: 255, reason: 'Ayatul Kursi — the greatest verse of the Quran.' },
        { surahNumber: 36, startVerse: 1, endVerse: 5, reason: 'Opening of Yasin — the heart of the Quran.' },
        { surahNumber: 55, startVerse: 1, endVerse: 4, reason: 'Ar-Rahman — opening mercy and creation of man.' },
    ],
};

function cacheKey(type: string, ...parts: string[]): string {
    const suffix = parts.join('_').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 80);
    return `${CACHE_PREFIX}${type}_${suffix}`;
}

async function readCache<T>(key: string): Promise<T | null> {
    try {
        const value = await AsyncStorage.getItem(key);
        return value ? JSON.parse(value) as T : null;
    } catch {
        return null;
    }
}

async function writeCache(key: string, value: unknown): Promise<void> {
    try {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Caching is an optimization; the feature must remain usable without it.
    }
}

async function getHistory(key: string): Promise<string[]> {
    const history = await readCache<unknown>(key);
    return Array.isArray(history) && history.every((item) => typeof item === 'string') ? history : [];
}

async function rememberVerses(verses: VerseSelection[]): Promise<void> {
    const history = await getHistory(VERSE_HISTORY_KEY);
    const entries = verses.map((verse) => `${verse.surahNumber}:${verse.startVerse}-${verse.endVerse}`);
    await writeCache(VERSE_HISTORY_KEY, [...entries, ...history].slice(0, MAX_VERSE_HISTORY));
}

async function rememberIntent(intent: ReflectionIntent): Promise<void> {
    const history = await getHistory(INTENT_HISTORY_KEY);
    await writeCache(INTENT_HISTORY_KEY, [intent.label, ...history].slice(0, MAX_INTENT_HISTORY));
}

function getFallbackVerses(category: IntentCategory, count: number): VerseSelection[] {
    const verses = FALLBACK_VERSES[category] || FALLBACK_VERSES.custom;
    const safeCount = Number.isFinite(count) ? Math.floor(count) : 3;
    return verses.slice(0, Math.min(Math.max(safeCount, 1), verses.length));
}

function isValidVerseSelection(value: unknown): value is VerseSelection {
    if (!value || typeof value !== 'object') return false;
    const verse = value as Partial<VerseSelection>;
    const { surahNumber, startVerse, endVerse, reason } = verse;
    return typeof surahNumber === 'number'
        && typeof startVerse === 'number'
        && typeof endVerse === 'number'
        && Number.isInteger(surahNumber)
        && Number.isInteger(startVerse)
        && Number.isInteger(endVerse)
        && surahNumber >= 1
        && surahNumber <= 114
        && startVerse >= 1
        && endVerse >= startVerse
        && endVerse - startVerse <= 4
        && typeof reason === 'string'
        && reason.trim().length > 0;
}

function getDefaultPrompts(): ReflectionPrompt[] {
    return [
        {
            id: 'default_1',
            text: 'How does this verse speak to your current life situation?',
            category: 'personal',
            aiGenerated: false,
        },
        {
            id: 'default_2',
            text: 'What blessing does this verse remind you of?',
            category: 'gratitude',
            aiGenerated: false,
        },
        {
            id: 'default_3',
            text: 'What is one small action you can take based on this verse today?',
            category: 'action',
            aiGenerated: false,
        },
    ];
}

/** Select a validated, curated set without a network dependency. */
export async function selectVersesForIntent(
    intent: ReflectionIntent,
    count = 3,
): Promise<VerseSelection[]> {
    const safeCount = Number.isFinite(count) ? Math.floor(count) : 3;
    const requestedCount = Math.min(Math.max(safeCount, 1), 3);
    const key = cacheKey('verses', intent.category, String(requestedCount));
    const cached = await readCache<unknown>(key);
    const cachedVerses = Array.isArray(cached)
        ? cached.filter(isValidVerseSelection).slice(0, requestedCount)
        : [];
    const verses = cachedVerses.length === requestedCount
        ? cachedVerses
        : getFallbackVerses(intent.category, requestedCount);

    if (cachedVerses.length !== requestedCount) await writeCache(key, verses);
    await rememberVerses(verses);
    await rememberIntent(intent);
    return verses;
}

/** Return stable reflection prompts; remote generation is optional, never required. */
export async function generateReflectionPrompts(
    _surahNumber: number,
    _startVerse: number,
    _endVerse: number,
    _surahName: string,
    _intent: ReflectionIntent,
    _arabicText?: string,
    _translationText?: string,
): Promise<ReflectionPrompt[]> {
    return getDefaultPrompts();
}

/** Provide transparent curated suggestions when optional generative AI is unavailable. */
export async function suggestIntents(recentHistory?: string[]): Promise<ReflectionIntent[]> {
    const history = recentHistory || await getHistory(INTENT_HISTORY_KEY);
    const used = new Set(history.map((item) => item.toLowerCase()));

    return DEFAULT_INTENTS
        .map((intent, index) => ({ ...intent, id: `curated_intent_${index}` }))
        .filter((intent) => !used.has(intent.label.toLowerCase()))
        .slice(0, 3);
}

/** Kept for callers that distinguish optional AI from the always-available flow. */
export function isAiAvailable(): boolean {
    return false;
}

/** Backward-compatible single-prompt helper. */
export async function generateReflectionPrompt(
    _surah: number,
    _verse: number,
    _context: string,
    _mood?: string,
): Promise<string> {
    return getDefaultPrompts()[0].text;
}
