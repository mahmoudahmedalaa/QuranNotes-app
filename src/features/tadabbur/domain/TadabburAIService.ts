/**
 * TadabburAIService — AI brain for Tadabbur Mode
 *
 * Uses Firebase AI Logic (Gemini 2.5 Flash) for:
 *  1. Selecting contextually appropriate verses based on user intent
 *  2. Generating personalized reflection prompts
 *  3. Suggesting reflection intents based on mood/history
 *
 * Follows the same pattern as TafsirService.ts:
 *  - firebase/ai SDK with GoogleAIBackend
 *  - AsyncStorage caching
 *  - generateWithRetry() for 429 handling
 *  - extractText() for safe response parsing
 *
 * Falls back to curated verse sets if AI is unavailable.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// Polyfill AbortSignal.any() — Hermes doesn't support it but firebase/ai needs it
import '../../../core/polyfills/abortSignalAny';
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import { getApp } from 'firebase/app';
// Ensure the compat firebase.initializeApp() has run
import '../../../core/firebase/config';

import type {
    ReflectionIntent,
    VerseSelection,
    ReflectionPrompt,
    IntentCategory,
    PromptCategory,
} from './entities/Reflection';

// ── Constants ──
const CACHE_PREFIX = 'tadabbur_ai_v2_';
const INTENT_HISTORY_KEY = 'tadabbur_intent_history';
const VERSE_HISTORY_KEY = 'tadabbur_verse_history';
const MAX_INTENT_HISTORY = 20;
const MAX_VERSE_HISTORY = 50;

// ── Quran Structure — for validation ──
const SURAH_VERSE_COUNTS: Record<number, number> = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206, 8: 75, 9: 129, 10: 109,
    11: 123, 12: 111, 13: 43, 14: 52, 15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135,
    21: 112, 22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88, 29: 69, 30: 60,
    31: 34, 32: 30, 33: 73, 34: 54, 35: 45, 36: 83, 37: 182, 38: 88, 39: 75, 40: 85,
    41: 54, 42: 53, 43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18, 50: 45,
    51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96, 57: 29, 58: 22, 59: 24, 60: 13,
    61: 14, 62: 11, 63: 11, 64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
    71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50, 78: 40, 79: 46, 80: 42,
    81: 29, 82: 19, 83: 36, 84: 25, 85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20,
    91: 15, 92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8, 99: 8, 100: 11,
    101: 11, 102: 8, 103: 3, 104: 9, 105: 5, 106: 4, 107: 7, 108: 3, 109: 6, 110: 3,
    111: 5, 112: 4, 113: 5, 114: 6,
};

// ── Fallback Verse Sets (per intent category, used when AI is offline) ──
const FALLBACK_VERSES: Record<IntentCategory, VerseSelection[]> = {
    patience: [
        { surahNumber: 2, startVerse: 153, endVerse: 155, reason: 'Classic ayat on patience and perseverance through trials.' },
        { surahNumber: 39, startVerse: 10, endVerse: 10, reason: 'The reward of those who are patient is given without measure.' },
        { surahNumber: 3, startVerse: 186, endVerse: 186, reason: 'You will surely be tested in your possessions and in yourselves.' },
    ],
    gratitude: [
        { surahNumber: 14, startVerse: 7, endVerse: 7, reason: 'If you are grateful, I will surely increase you.' },
        { surahNumber: 55, startVerse: 1, endVerse: 4, reason: 'A beautiful enumeration of Allah\'s countless blessings.' },
        { surahNumber: 31, startVerse: 12, endVerse: 14, reason: 'Luqman\'s wisdom on gratitude to Allah and parents.' },
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
        { surahNumber: 57, startVerse: 4, endVerse: 4, reason: 'He is with you wherever you are — a reminder of Allah\'s constant closeness.' },
        { surahNumber: 93, startVerse: 1, endVerse: 5, reason: 'Your Lord has not forsaken you, nor has He become displeased — divine companionship.' },
    ],
    general: [
        { surahNumber: 2, startVerse: 255, endVerse: 255, reason: 'Ayatul Kursi — the greatest verse of the Quran.' },
        { surahNumber: 36, startVerse: 1, endVerse: 5, reason: 'Opening of Yasin — the heart of the Quran.' },
        { surahNumber: 55, startVerse: 1, endVerse: 4, reason: 'Ar-Rahman — opening mercy and creation of man.' },
    ],
};

// ── Gemini model reference ──
let _model: ReturnType<typeof getGenerativeModel> | null = null;
let _initAttempted = false;

/**
 * Safely extract text from a generateContent result.
 * Handles various SDK response shapes (method vs property vs raw candidates).
 */
function extractText(result: any): string {
    try {
        const response = result?.response;
        if (!response) return '';

        if (typeof response.text === 'function') {
            return response.text() || '';
        }
        if (typeof response.text === 'string') {
            return response.text;
        }

        const candidates = response.candidates;
        if (candidates?.length > 0) {
            const parts = candidates[0]?.content?.parts;
            if (parts?.length > 0 && parts[0]?.text) {
                return parts[0].text;
            }
        }
        return '';
    } catch (e) {
        if (__DEV__) console.warn('[TadabburAI] Text extraction failed:', e);
        return '';
    }
}

/**
 * Generate content with automatic retry + exponential backoff for 429.
 */
async function generateWithRetry(
    model: ReturnType<typeof getGenerativeModel>,
    prompt: string,
    maxRetries = 3,
): Promise<string> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            return extractText(result);
        } catch (e: any) {
            const msg = e?.message || '';
            const is429 = msg.includes('429') || msg.includes('quota') || msg.includes('rate');

            if (is429 && attempt < maxRetries) {
                const delay = Math.pow(2, attempt + 1) * 1000;
                if (__DEV__) console.warn(`[TadabburAI] Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            throw e;
        }
    }
    return '';
}

/**
 * Lazily initialize the Firebase AI Logic model.
 */
function getModel(): ReturnType<typeof getGenerativeModel> | null {
    if (_model) return _model;
    if (_initAttempted) return null;

    _initAttempted = true;

    try {
        const app = getApp();
        if (__DEV__) console.log('[TadabburAI] Firebase app:', app.name, 'project:', app.options.projectId);
        const ai = getAI(app, { backend: new VertexAIBackend() });
        _model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });
        if (__DEV__) console.log('[TadabburAI] ✅ AI model ready');
        return _model;
    } catch (e: any) {
        if (__DEV__) console.error('[TadabburAI] ❌ AI init failed:', e?.message || e);
        return null;
    }
}

// ── Cache helpers ──
function buildCacheKey(type: string, ...parts: string[]): string {
    return `${CACHE_PREFIX}${type}_${parts.join('_').slice(0, 80).replace(/[^a-zA-Z0-9_]/g, '_')}`;
}

async function checkCache(key: string): Promise<string | null> {
    try {
        return await AsyncStorage.getItem(key);
    } catch {
        return null;
    }
}

async function setCache(key: string, value: string): Promise<void> {
    try {
        await AsyncStorage.setItem(key, value);
    } catch {
        // Ignore cache write failures
    }
}

// ── History helpers ──

async function getVerseHistory(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(VERSE_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function addToVerseHistory(verses: VerseSelection[]): Promise<void> {
    try {
        const history = await getVerseHistory();
        const newEntries = verses.map(v => `${v.surahNumber}:${v.startVerse}-${v.endVerse}`);
        const updated = [...newEntries, ...history].slice(0, MAX_VERSE_HISTORY);
        await AsyncStorage.setItem(VERSE_HISTORY_KEY, JSON.stringify(updated));
    } catch {
        // Ignore
    }
}

async function getIntentHistory(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(INTENT_HISTORY_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function addToIntentHistory(intent: ReflectionIntent): Promise<void> {
    try {
        const history = await getIntentHistory();
        const updated = [intent.label, ...history].slice(0, MAX_INTENT_HISTORY);
        await AsyncStorage.setItem(INTENT_HISTORY_KEY, JSON.stringify(updated));
    } catch {
        // Ignore
    }
}

// ── Validation ──

function isValidVerseSelection(v: any): v is VerseSelection {
    if (!v || typeof v !== 'object') return false;
    const { surahNumber, startVerse, endVerse } = v;

    if (typeof surahNumber !== 'number' || surahNumber < 1 || surahNumber > 114) return false;

    const maxVerse = SURAH_VERSE_COUNTS[surahNumber];
    if (!maxVerse) return false;

    if (typeof startVerse !== 'number' || startVerse < 1 || startVerse > maxVerse) return false;
    if (typeof endVerse !== 'number' || endVerse < startVerse || endVerse > maxVerse) return false;

    // Max 5 verses for meditation — keeps audio focused (30-90s)
    if (endVerse - startVerse > 4) return false;

    return true;
}

/**
 * Parse JSON from AI text, handling markdown code fences.
 */
function parseJsonFromText(text: string): any {
    // Strip markdown code fences if present
    const cleaned = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    return JSON.parse(cleaned);
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Select contextually appropriate verses for a given reflection intent.
 * Uses AI when available, falls back to curated verse sets.
 *
 * @returns 2-3 VerseSelection objects with reasons
 */
export async function selectVersesForIntent(
    intent: ReflectionIntent,
    count: number = 3,
): Promise<VerseSelection[]> {
    // Check cache first
    const cacheKey = buildCacheKey('verses', intent.label, String(count), String(Date.now()).slice(0, -6));
    const cached = await checkCache(cacheKey);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidVerseSelection)) {
                return parsed;
            }
        } catch {
            // Cache miss or invalid
        }
    }

    const model = getModel();
    if (!model) {
        if (__DEV__) console.log('[TadabburAI] AI unavailable, using fallback verses');
        return getFallbackVerses(intent.category, count);
    }

    try {
        const verseHistory = await getVerseHistory();
        const historyContext = verseHistory.length > 0
            ? `\nRECENTLY USED VERSES (avoid these): ${verseHistory.join(', ')}`
            : '';

        const prompt = `You are a knowledgeable Islamic scholar specializing in Quran tadabbur (deep reflection and contemplation).

Given the user's spiritual intent, select ${count} Quranic passages that are most meaningful for meditation and reflection.

USER'S INTENT: "${intent.label}"
CATEGORY: ${intent.category}
${historyContext}

RULES:
1. Select verses with deep, contemplative meaning suitable for meditation
2. Keep passages focused: 1-3 verses ideal for meditation (max 5). Shorter is better for deep reflection
3. AVOID very short surahs (e.g., Al-Ikhlas 112, Al-Kawthar 108) unless specifically relevant to the intent
4. Consider verse context — don't pull a verse mid-sentence
5. Each selection should approach the intent from a different angle
6. ABSOLUTELY DO NOT select verses that don't exist. Verify surah numbers (1-114) and verse counts.
7. Return ONLY valid JSON, no extra text

Return EXACTLY this JSON format:
[
  {"surahNumber": N, "startVerse": N, "endVerse": N, "reason": "Brief explanation of why this verse fits the intent"},
  ...
]`;

        // Race against a 6s timeout — slow AI is worse than curated fallback
        const text = await Promise.race([
            generateWithRetry(model, prompt),
            new Promise<string>((_, reject) =>
                setTimeout(() => reject(new Error('AI_TIMEOUT')), 6000),
            ),
        ]);

        if (text) {
            try {
                const parsed = parseJsonFromText(text);
                if (Array.isArray(parsed)) {
                    const valid = parsed.filter(isValidVerseSelection).slice(0, count);
                    if (valid.length > 0) {
                        await setCache(cacheKey, JSON.stringify(valid));
                        await addToVerseHistory(valid);
                        await addToIntentHistory(intent);
                        return valid;
                    }
                }
            } catch (parseErr) {
                if (__DEV__) console.warn('[TadabburAI] JSON parse error:', parseErr);
            }
        }

        // AI responded but gave bad data — use fallback
        if (__DEV__) console.warn('[TadabburAI] AI returned invalid verse data, using fallback');
        return getFallbackVerses(intent.category, count);
    } catch (e: any) {
        if (__DEV__) console.warn('[TadabburAI] Verse selection error:', e?.message || e);
        return getFallbackVerses(intent.category, count);
    }
}

/**
 * Generate AI reflection prompts for a specific verse and intent.
 * Pro-only feature — free users see default prompts.
 */
export async function generateReflectionPrompts(
    surahNumber: number,
    startVerse: number,
    endVerse: number,
    surahName: string,
    intent: ReflectionIntent,
    arabicText?: string,
    translationText?: string,
): Promise<ReflectionPrompt[]> {
    const cacheKey = buildCacheKey(
        'prompts',
        String(surahNumber),
        String(startVerse),
        String(endVerse),
        intent.label,
    );
    const cached = await checkCache(cacheKey);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch {
            // Cache miss
        }
    }

    const model = getModel();
    if (!model) {
        return getDefaultPrompts();
    }

    try {
        const verseRef = `${surahName} (${surahNumber}:${startVerse}${startVerse !== endVerse ? `-${endVerse}` : ''})`;
        const translationContext = translationText
            ? `\nVERSE TRANSLATION: "${translationText}"`
            : '';

        const prompt = `You are a gentle spiritual guide helping someone reflect on a Quran verse during meditation.

VERSE: ${verseRef}${translationContext}
USER'S INTENT: "${intent.label}" (${intent.category})

Generate 3 reflection prompts (questions or gentle invitations to reflect) that:
1. Connect the verse's meaning to the user's stated intent
2. Are personal and introspective (use "you" and "your")
3. Are 1-2 sentences each, warm and contemplative in tone
4. Cover different angles: personal application, gratitude, and action

RESPOND ONLY with this JSON format:
[
  {"id": "p1", "text": "reflection question here", "category": "personal", "aiGenerated": true},
  {"id": "p2", "text": "reflection question here", "category": "gratitude", "aiGenerated": true},
  {"id": "p3", "text": "reflection question here", "category": "action", "aiGenerated": true}
]`;

        const text = await generateWithRetry(model, prompt);

        if (text) {
            try {
                const parsed = parseJsonFromText(text);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    const prompts: ReflectionPrompt[] = parsed.slice(0, 3).map((p: any, i: number) => ({
                        id: p.id || `ai_prompt_${i}`,
                        text: String(p.text || ''),
                        category: (['personal', 'gratitude', 'action', 'contemplation'].includes(p.category) ? p.category : 'contemplation') as PromptCategory,
                        aiGenerated: true,
                    }));
                    await setCache(cacheKey, JSON.stringify(prompts));
                    return prompts;
                }
            } catch {
                // Parse failure — use defaults
            }
        }

        return getDefaultPrompts();
    } catch (e: any) {
        if (__DEV__) console.warn('[TadabburAI] Prompt generation error:', e?.message || e);
        return getDefaultPrompts();
    }
}

/**
 * Suggest personalized reflection intents based on recent history.
 * Pro-only feature.
 */
export async function suggestIntents(
    recentHistory?: string[],
): Promise<ReflectionIntent[]> {
    const model = getModel();
    if (!model) {
        return [];
    }

    try {
        const history = recentHistory || await getIntentHistory();
        const historyContext = history.length > 0
            ? `\nRecent intents used: ${history.slice(0, 10).join(', ')}`
            : '';

        // Time-aware suggestions
        const hour = new Date().getHours();
        let timeContext = 'during the day';
        if (hour >= 3 && hour < 7) timeContext = 'in the early morning (Fajr time)';
        else if (hour >= 7 && hour < 12) timeContext = 'in the morning';
        else if (hour >= 15 && hour < 18) timeContext = 'in the afternoon (Asr time)';
        else if (hour >= 18 && hour < 21) timeContext = 'in the evening (Maghrib time)';
        else if (hour >= 21 || hour < 3) timeContext = 'at night (Isha/Tahajjud time)';

        const prompt = `You are a thoughtful Islamic spiritual guide.

Suggest 3 unique reflection intents for someone ${timeContext} who wants to contemplate the Quran.
${historyContext}

Each intent should be a short, warm phrase (4-8 words) that captures a spiritual need.
Make them diverse — cover different emotional and spiritual states.
AVOID repeating recent intents if provided.

Return ONLY this JSON:
[
  {"label": "intent phrase", "category": "one of: gratitude|patience|hope|repentance|trust|guidance|remembrance", "icon": "material-community-icon-name"},
  ...
]

Use only these icon names: heart-outline, shield-heart-outline, hand-heart-outline, white-balance-sunny, hand-extended-outline, compass-outline, star-four-points-outline, book-open-variant, candle, flower-outline`;

        const text = await generateWithRetry(model, prompt);

        if (text) {
            try {
                const parsed = parseJsonFromText(text);
                if (Array.isArray(parsed)) {
                    return parsed.slice(0, 3).map((p: any, i: number) => ({
                        id: `ai_intent_${Date.now()}_${i}`,
                        label: String(p.label || ''),
                        icon: String(p.icon || 'star-four-points-outline'),
                        category: (['gratitude', 'patience', 'hope', 'repentance', 'trust', 'guidance', 'remembrance'].includes(p.category) ? p.category : 'custom') as IntentCategory,
                        isAiSuggested: true,
                        isCustom: false,
                    }));
                }
            } catch {
                // Parse failure
            }
        }

        return [];
    } catch (e: any) {
        if (__DEV__) console.warn('[TadabburAI] Intent suggestion error:', e?.message || e);
        return [];
    }
}

/**
 * Check if Firebase AI Logic is available for Tadabbur.
 */
export function isAiAvailable(): boolean {
    return getModel() !== null;
}

/**
 * @deprecated Use generateReflectionPrompts() instead.
 * Kept for backward compat with TadabburContext.tsx until Phase 3 rewrite.
 */
export async function generateReflectionPrompt(
    _surah: number,
    _verse: number,
    _context: string,
    _mood?: string,
): Promise<string> {
    const model = getModel();
    if (!model) return '';

    try {
        const prompt = `You are a gentle Quran reflection guide. Generate a single reflection question for verse ${_surah}:${_verse}. Context: ${_context}. ${_mood ? `Mood: ${_mood}` : ''}. Return only the question text, nothing else.`;
        return await generateWithRetry(model, prompt);
    } catch {
        return '';
    }
}

// ── Private helpers ──

function getFallbackVerses(category: IntentCategory, count: number): VerseSelection[] {
    const fallbacks = FALLBACK_VERSES[category] || FALLBACK_VERSES.custom;
    // Shuffle and pick `count` verses
    const shuffled = [...fallbacks].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
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
