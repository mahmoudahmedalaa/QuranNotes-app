/**
 * NoorAIService — Unified AI brain for the Noor AI companion.
 *
 * Wraps Firebase AI Logic (Gemini 2.5 Flash) with:
 *  1. Noor's warm, scholarly persona
 *  2. Multi-turn conversation context
 *  3. Verse-grounded and open Q&A modes
 *  4. Smart tafsir context injection
 *
 * Falls back gracefully if Firebase AI Logic is not configured.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import '../../../core/polyfills/abortSignalAny';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import { getApp } from 'firebase/app';
import '../../../core/firebase/config';

import { NoorMessage, VerseContext } from './types';

// ── Constants ──
const CACHE_PREFIX = 'noor_ai_v1_';
const MAX_CONTEXT_MESSAGES = 10;
const MAX_TAFSIR_CHARS = 3000;

// ── Gemini model reference ──
let _model: ReturnType<typeof getGenerativeModel> | null = null;
let _initAttempted = false;

// ── Noor Persona ──
const NOOR_SYSTEM_PROMPT = `You are Noor, a warm and knowledgeable AI companion inside the QuranNotes app. You help Muslims understand and reflect on the Holy Quran.

YOUR PERSONALITY:
- Warm, approachable, and humble — like a kind friend who studied Islamic sciences
- You begin your first message in a conversation with "Assalamu Alaikum" but not subsequent messages
- You use respectful Islamic phrases naturally (e.g., "SubhanAllah", "In sha Allah")
- You are encouraging and supportive, never judgmental

YOUR EXPERTISE:
- Quran tafsir (commentary) based on classical scholars (Ibn Kathir, Al-Sa'di)
- Quranic themes, stories, and connections between verses
- Practical reflection and application of Quranic teachings
- Basic Islamic concepts that relate to Quran study

CRITICAL RULES:
1. ALWAYS respond in English only. Never include Arabic script.
2. Be CONCISE — maximum 4-6 sentences for simple questions, up to 8 for complex topics.
3. When given tafsir context, ground your answers in that scholarship. Always cite the scholar.
4. Never fabricate hadith or tafsir. If unsure, say "I'd recommend consulting a scholar for this specific question."
5. For questions outside Islam/Quran, gently redirect: "I'm best at helping with Quran-related questions!"
6. Use markdown formatting: **bold** for emphasis, bullet points for lists.
7. End scholarly answers with the source (e.g., "— Based on Ibn Kathir's commentary").`;

/**
 * Safely extract text from a generateContent result.
 */
function extractText(result: any): string {
    try {
        const response = result?.response;
        if (!response) return '';

        if (typeof response.text === 'function') return response.text() || '';
        if (typeof response.text === 'string') return response.text;

        const candidates = response.candidates;
        if (candidates?.length > 0) {
            const parts = candidates[0]?.content?.parts;
            if (parts?.length > 0 && parts[0]?.text) return parts[0].text;
        }
        return '';
    } catch (e) {
        if (__DEV__) console.warn('[NoorAI] Text extraction failed:', e);
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
                if (__DEV__) console.warn(`[NoorAI] Rate limited, retrying in ${delay / 1000}s`);
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
        const ai = getAI(app, { backend: new GoogleAIBackend() });
        _model = getGenerativeModel(ai, { model: 'gemini-1.5-flash' });
        if (__DEV__) console.log('[NoorAI] ✅ AI model ready');
        return _model;
    } catch (e: any) {
        if (__DEV__) console.error('[NoorAI] ❌ AI init failed:', e?.message || e);
        return null;
    }
}

// ── Cache helpers ──
function buildCacheKey(question: string, verseContext?: VerseContext): string {
    const base = verseContext
        ? `${CACHE_PREFIX}${verseContext.surahNumber}_${verseContext.verseNumber}`
        : `${CACHE_PREFIX}general`;
    const qHash = question.slice(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
    return `${base}_${qHash}`;
}

async function checkCache(key: string): Promise<string | null> {
    try { return await AsyncStorage.getItem(key); }
    catch { return null; }
}

async function setCache(key: string, value: string): Promise<void> {
    try { await AsyncStorage.setItem(key, value); }
    catch { /* ignore */ }
}

/**
 * Strip non-Latin characters from tafsir text.
 */
function stripToEnglish(text: string): string {
    return text
        .replace(/[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g, '')
        .replace(/[\u0400-\u04FF]/g, '')
        .replace(/[\u0900-\u097F\u3000-\u9FFF\uAC00-\uD7AF]/g, '')
        .replace(/\s{3,}/g, '\n\n')
        .trim();
}

/**
 * Build the full prompt with conversation history and context.
 */
function buildPrompt(
    question: string,
    conversationHistory: NoorMessage[],
    tafsirContext?: string,
    verseContext?: VerseContext,
): string {
    let prompt = NOOR_SYSTEM_PROMPT;

    // Add verse context if available
    if (verseContext) {
        prompt += `\n\nCURRENT VERSE CONTEXT:
Verse: ${verseContext.surahName} (${verseContext.surahNumber}:${verseContext.verseNumber})`;

        if (verseContext.translation) {
            prompt += `\nTranslation: "${verseContext.translation}"`;
        }
    }

    // Add tafsir context if available
    if (tafsirContext) {
        const cleaned = stripToEnglish(tafsirContext);
        const truncated = cleaned.length > MAX_TAFSIR_CHARS
            ? cleaned.slice(0, MAX_TAFSIR_CHARS) + '...'
            : cleaned;
        prompt += `\n\nSCHOLAR'S COMMENTARY:\n${truncated}`;
    }

    // Add conversation history (last N messages for context)
    const recentMessages = conversationHistory.slice(-MAX_CONTEXT_MESSAGES);
    if (recentMessages.length > 0) {
        prompt += '\n\nCONVERSATION HISTORY:';
        for (const msg of recentMessages) {
            const speaker = msg.role === 'user' ? 'User' : 'Noor';
            prompt += `\n${speaker}: ${msg.content}`;
        }
    }

    // Add the current question
    prompt += `\n\nUser: ${question}\n\nNoor:`;

    return prompt;
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

export interface NoorResponse {
    answer: string;
    cached: boolean;
    suggestedQuestions?: string[];
}

/**
 * Ask Noor a question — the main entry point.
 *
 * @param question - The user's question
 * @param conversationHistory - Previous messages in this conversation
 * @param tafsirContext - Optional tafsir text for grounding
 * @param verseContext - Optional verse reference
 */
export async function askNoor(
    question: string,
    conversationHistory: NoorMessage[] = [],
    tafsirContext?: string,
    verseContext?: VerseContext,
): Promise<NoorResponse> {
    // Check cache (only for first message, not follow-ups)
    if (conversationHistory.length === 0) {
        const cacheKey = buildCacheKey(question, verseContext);
        const cached = await checkCache(cacheKey);
        if (cached) {
            return { answer: cached, cached: true };
        }
    }

    const model = getModel();
    if (!model) {
        return {
            answer: 'I need an internet connection to help you. Please check your connection and try again.',
            cached: false,
        };
    }

    const prompt = buildPrompt(question, conversationHistory, tafsirContext, verseContext);

    try {
        const text = await generateWithRetry(model, prompt);

        if (!text) {
            return { answer: 'I wasn\'t able to generate a response. Please try again.', cached: false };
        }

        // Cache first-message responses
        if (conversationHistory.length === 0) {
            const cacheKey = buildCacheKey(question, verseContext);
            await setCache(cacheKey, text);
        }

        return { answer: text, cached: false };
    } catch (e: any) {
        if (__DEV__) console.warn('[NoorAI] Error:', e?.message || e);

        if (e?.message?.includes('429') || e?.message?.includes('quota') || e?.message?.includes('rate')) {
            return {
                answer: 'I\'m receiving a lot of questions right now. Please try again in a moment! 🤲',
                cached: false,
            };
        }

        if (e?.message?.includes('403') || e?.message?.includes('billing') || e?.message?.includes('permission')) {
            return {
                answer: 'AI features are temporarily unavailable. Please try again later.',
                cached: false,
            };
        }

        return {
            answer: 'Something went wrong. Please check your connection and try again.',
            cached: false,
        };
    }
}

/**
 * Get suggested questions based on context.
 */
export function getSuggestedQuestions(verseContext?: VerseContext): string[] {
    if (verseContext) {
        return [
            `What does ${verseContext.surahName} ${verseContext.verseNumber} teach us?`,
            'What is the historical context of this verse?',
            'How can I apply this verse in my daily life?',
            'Are there related verses on this topic?',
        ];
    }

    return [
        'What are the main themes of Surah Al-Baqarah?',
        'How does the Quran describe patience?',
        'What is the story of Prophet Yusuf (AS)?',
        'What does the Quran say about gratitude?',
    ];
}

/**
 * Check if Noor AI is available (Firebase AI configured).
 */
export function isNoorAvailable(): boolean {
    return getModel() !== null;
}
