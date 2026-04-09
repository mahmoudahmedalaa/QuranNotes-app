/**
 * TafsirService — AI layer for tafsir summaries and verse Q&A.
 *
 * Uses Firebase AI Logic (Gemini Flash) via the Firebase JS SDK for:
 *  1. Summarizing classical tafsir commentary into accessible language
 *  2. Answering user questions about a verse, grounded in tafsir context
 *
 * Falls back gracefully if Firebase AI Logic is not configured.
 * AsyncStorage caching prevents redundant API calls.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
// Polyfill AbortSignal.any() — Hermes doesn't support it but firebase/ai needs it
import '../../../core/polyfills/abortSignalAny';
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import { getApp } from 'firebase/app';
// Ensure the compat firebase.initializeApp() has run before we call getApp()
import '../../../core/firebase/config';

import { TafsirSource, TAFSIR_SOURCE_LABELS, AiQueryResult } from './types';

// ── Cache config ──
const CACHE_PREFIX = 'tafsir_ai_v3_';

/**
 * Strip all non-Latin characters from text before sending to AI.
 * Removes Arabic, Cyrillic, CJK, and other scripts — keeps only
 * English letters, digits, basic punctuation, and whitespace.
 * This guarantees the AI never sees non-English text.
 */
function stripToEnglish(text: string): string {
    return text
        // Remove Arabic Unicode block (U+0600–U+06FF, U+0750–U+077F, U+FB50–U+FDFF, U+FE70–U+FEFF)
        .replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
        // Remove Cyrillic (U+0400–U+04FF)
        .replace(/[\u0400-\u04FF]/g, '')
        // Remove other extended scripts (CJK, Devanagari, etc.)
        .replace(/[\u0900-\u097F\u3000-\u9FFF\uAC00-\uD7AF]/g, '')
        // Collapse multiple spaces/newlines
        .replace(/\s{3,}/g, '\n\n')
        .trim();
}

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

        // Try text() as a method (official API)
        if (typeof response.text === 'function') {
            return response.text() || '';
        }

        // Try text as a property (some SDK versions)
        if (typeof response.text === 'string') {
            return response.text;
        }

        // Fallback: extract from raw candidates
        const candidates = response.candidates;
        if (candidates?.length > 0) {
            const parts = candidates[0]?.content?.parts;
            if (parts?.length > 0 && parts[0]?.text) {
                return parts[0].text;
            }
        }

        return '';
    } catch (e) {
        if (__DEV__) console.warn('[TafsirService] Text extraction failed:', e);
        return '';
    }
}

/**
 * Generate content with automatic retry + exponential backoff for 429.
 * Retries up to 3 times with delays: 2s, 4s, 8s.
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
                const delay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
                if (__DEV__) console.warn(`[TafsirService] Rate limited, retrying in ${delay / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }

            throw e; // re-throw if not 429 or out of retries
        }
    }
    return ''; // shouldn't reach here
}

/**
 * Lazily initialize the Firebase AI Logic model.
 * Returns null if the SDK is not available.
 */
function getModel(): ReturnType<typeof getGenerativeModel> | null {
    if (_model) return _model;
    if (_initAttempted) return null;

    _initAttempted = true;

    try {
        const app = getApp();
        if (__DEV__) console.log('[TafsirService] Firebase app:', app.name, 'project:', app.options.projectId);
        const ai = getAI(app, { backend: new VertexAIBackend() });
        _model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });
        if (__DEV__) console.log('[TafsirService] ✅ AI model ready');
        return _model;
    } catch (e: any) {
        if (__DEV__) console.error('[TafsirService] ❌ AI init failed:', e?.message || e);
        return null;
    }
}

// ── Cache helpers ──
function buildCacheKey(type: string, source: TafsirSource, surah: number, verse: number, extra?: string): string {
    const base = `${CACHE_PREFIX}${type}_${source}_${surah}_${verse}`;
    return extra ? `${base}_${extra.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_')}` : base;
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

/**
 * Build system prompt for tafsir AI interactions.
 */
function buildSystemPrompt(source: TafsirSource): string {
    const sourceName = TAFSIR_SOURCE_LABELS[source];
    return `You are a knowledgeable Islamic scholar assistant specializing in Quran tafsir (commentary).
Your role is to help users understand Quran verses through the lens of classical tafsir scholarship.

CRITICAL RULES:
1. ALWAYS respond in English only. Never mix other languages.
2. Only reference the specific tafsir source provided (${sourceName}).
3. Be BRIEF — maximum 4-5 sentences total.
4. Use simple, clear language for a general audience.
5. Maintain a respectful, scholarly tone.
6. End with "Source: ${sourceName}" on its own line.
7. Never make up tafsir content — only reference what's provided.
8. Do NOT include Arabic transliterations or quotes from other languages.`;
}

/**
 * Generate an accessible AI summary of tafsir commentary.
 */
export async function summarizeTafsir(
    arabicText: string,
    translation: string,
    tafsirText: string,
    source: TafsirSource,
    surahName: string,
    surahNumber: number,
    verseNumber: number,
): Promise<AiQueryResult> {
    // Check cache first
    const cacheKey = buildCacheKey('summary', source, surahNumber, verseNumber);
    const cached = await checkCache(cacheKey);
    if (cached) {
        return { answer: cached, cached: true };
    }

    const model = getModel();
    if (!model) {
        return {
            answer: 'AI summaries are not available. Please check your internet connection.',
            cached: false,
        };
    }

    // Strip non-English text and truncate to avoid token limit issues
    const maxTafsirLength = 3000;
    const cleanedTafsir = stripToEnglish(tafsirText);
    const truncatedTafsir = cleanedTafsir.length > maxTafsirLength
        ? cleanedTafsir.slice(0, maxTafsirLength) + '...'
        : cleanedTafsir;

    const sourceName = TAFSIR_SOURCE_LABELS[source];
    const prompt = `${buildSystemPrompt(source)}

VERSE: ${surahName} (${surahNumber}:${verseNumber})

TAFSIR COMMENTARY (${sourceName}):
${truncatedTafsir}

IMPORTANT: The commentary above contains embedded Arabic Quran verses. Ignore them. Do NOT quote or reproduce any Arabic text. Write your entire response in plain English only.

Explain what this verse means in 4-5 simple sentences. End with "Source: ${sourceName}".`;

    try {
        const text = await generateWithRetry(model, prompt);

        if (text) {
            await setCache(cacheKey, text);
        }

        return { answer: text || 'Unable to generate summary.', cached: false };
    } catch (e: any) {
        if (__DEV__) console.warn('[TafsirService] AI summary error:', e?.message || e);

        if (e?.message?.includes('429') || e?.message?.includes('quota') || e?.message?.includes('rate')) {
            return {
                answer: 'AI explanations are temporarily unavailable due to high usage. Please try again later.',
                cached: false,
            };
        }

        if (e?.message?.includes('403') || e?.message?.includes('billing') || e?.message?.includes('permission')) {
            return {
                answer: 'AI features require Firebase billing to be enabled for this project.',
                cached: false,
            };
        }

        return {
            answer: 'Unable to generate explanation right now. Please check your connection.',
            cached: false,
        };
    }
}

/**
 * Ask a question about a verse, grounded in tafsir context.
 */
export async function askAboutVerse(
    question: string,
    arabicText: string,
    translation: string,
    tafsirText: string,
    source: TafsirSource,
    surahName: string,
    surahNumber: number,
    verseNumber: number,
): Promise<AiQueryResult> {
    // Check cache
    const cacheKey = buildCacheKey('question', source, surahNumber, verseNumber, question);
    const cached = await checkCache(cacheKey);
    if (cached) {
        return { answer: cached, cached: true };
    }

    const model = getModel();
    if (!model) {
        return {
            answer: 'AI features require an internet connection and are temporarily unavailable.',
            cached: false,
        };
    }

    const sourceName = TAFSIR_SOURCE_LABELS[source];

    // Strip non-English text and truncate
    const maxTafsirLength = 3000;
    const cleanedTafsir = tafsirText ? stripToEnglish(tafsirText) : '';
    const truncatedTafsir = cleanedTafsir.length > maxTafsirLength
        ? cleanedTafsir.slice(0, maxTafsirLength) + '...'
        : cleanedTafsir;

    const contextBlock = truncatedTafsir
        ? `TAFSIR COMMENTARY (${sourceName}):\n${truncatedTafsir}\n\n`
        : '';

    const prompt = `${buildSystemPrompt(source)}

VERSE: ${surahName} (${surahNumber}:${verseNumber})

${contextBlock}USER QUESTION: ${question}

Answer in English only. Keep your answer to 3-5 sentences. Be clear and concise. End with "Source: ${sourceName}".`;

    try {
        const text = await generateWithRetry(model, prompt);

        if (text) {
            await setCache(cacheKey, text);
        }

        return { answer: text || 'Unable to generate an answer.', cached: false };
    } catch (e: any) {
        if (__DEV__) console.warn('[TafsirService] AI question error:', e?.message || e);

        if (e?.message?.includes('429') || e?.message?.includes('quota') || e?.message?.includes('rate')) {
            return {
                answer: 'AI is temporarily unavailable due to high usage. Please try again later.',
                cached: false,
            };
        }

        return {
            answer: 'Unable to answer right now. Please check your connection and try again.',
            cached: false,
        };
    }
}

/**
 * Check if Firebase AI Logic is available.
 */
export function isAiAvailable(): boolean {
    return getModel() !== null;
}
