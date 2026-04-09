/**
 * NoorAIService — Unified AI brain for the Noor AI companion.
 *
 * Dual-backend architecture:
 *  1. PRIMARY: Firebase AI Logic (GoogleAIBackend) — secure, App Check ready
 *  2. FALLBACK: @google/generative-ai direct SDK — works with just API key
 *
 * If Firebase AI Logic fails (403/404 due to missing console setup),
 * the service automatically falls back to the direct SDK for the rest
 * of the session. Zero user-facing errors from config issues.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import '../../../core/polyfills/abortSignalAny';

// ── Firebase AI Logic (primary) ──
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';
import '../../../core/firebase/config';
import { getApp } from 'firebase/app';

// ── Direct Gemini SDK (fallback) ──
import { GoogleGenerativeAI } from '@google/generative-ai';

import { NoorMessage, VerseContext } from './types';

// ── Constants ──
const CACHE_PREFIX = 'noor_ai_v1_';
const MAX_CONTEXT_MESSAGES = 10;
const MAX_TAFSIR_CHARS = 3000;

// ── Backend state ──
type Backend = 'firebase' | 'direct' | null;
let _activeBackend: Backend = null;
let _firebaseModel: ReturnType<typeof getGenerativeModel> | null = null;
let _directModel: any = null;
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
 * Safely extract text from a generateContent result (works for both SDKs).
 */
function extractText(result: any): string {
    try {
        const response = result?.response ?? result;
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
 * Check if an error is a config/permission issue (403/404) that warrants
 * falling back to the direct SDK.
 */
function isConfigError(e: any): boolean {
    const msg = (e?.message || e?.toString?.() || '').toLowerCase();
    return (
        msg.includes('403') ||
        msg.includes('404') ||
        msg.includes('permission') ||
        msg.includes('blocked') ||
        msg.includes('not found') ||
        msg.includes('genai config') ||
        msg.includes('app check') ||
        msg.includes('app-check')
    );
}

/**
 * Check if an error is a rate-limit (429) that should trigger retry.
 */
function isRateLimitError(e: any): boolean {
    const msg = (e?.message || '').toLowerCase();
    return (
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('rate limit') ||
        msg.includes('resource_exhausted')
    );
}

// ═══════════════════════════════════════════════════════════════
// BACKEND INITIALIZATION
// ═══════════════════════════════════════════════════════════════

/**
 * Try to initialize Firebase AI Logic (VertexAIBackend).
 */
function initFirebaseBackend(): boolean {
    try {
        const app = getApp();
        const ai = getAI(app, { backend: new VertexAIBackend() });
        _firebaseModel = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });
        if (__DEV__) console.log('[NoorAI] ✅ Firebase AI Logic backend initialized');
        return true;
    } catch (e: any) {
        if (__DEV__) console.warn('[NoorAI] ⚠️ Firebase AI Logic init failed:', e?.message);
        return false;
    }
}

/**
 * Initialize the direct @google/generative-ai SDK as fallback.
 */
function initDirectBackend(): boolean {
    try {
        const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
        if (!apiKey) {
            if (__DEV__) console.error('[NoorAI] ❌ No API key available for direct backend');
            return false;
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        _directModel = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: NOOR_SYSTEM_PROMPT,
        });
        if (__DEV__) console.log('[NoorAI] ✅ Direct Gemini SDK backend initialized');
        return true;
    } catch (e: any) {
        if (__DEV__) console.error('[NoorAI] ❌ Direct backend init failed:', e?.message);
        return false;
    }
}

/**
 * Lazily initialize backends. Firebase first, direct as fallback.
 */
function ensureInitialized(): Backend {
    if (_activeBackend) return _activeBackend;
    if (_initAttempted) return _activeBackend;

    _initAttempted = true;

    // Try Firebase first
    if (initFirebaseBackend()) {
        _activeBackend = 'firebase';
        // Also pre-init direct backend so fallback is instant
        initDirectBackend();
        return 'firebase';
    }

    // Firebase init failed — go straight to direct
    if (initDirectBackend()) {
        _activeBackend = 'direct';
        return 'direct';
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════
// CONTENT GENERATION
// ═══════════════════════════════════════════════════════════════

/**
 * Generate content using Firebase AI Logic backend.
 */
async function generateViaFirebase(prompt: string): Promise<string> {
    if (!_firebaseModel) throw new Error('Firebase model not initialized');
    const result = await _firebaseModel.generateContent(prompt);
    return extractText(result);
}

/**
 * Generate content using direct @google/generative-ai SDK.
 * The system instruction is already set on the model, so we just send the user prompt.
 */
async function generateViaDirect(prompt: string): Promise<string> {
    if (!_directModel) throw new Error('Direct model not initialized');
    const result = await _directModel.generateContent(prompt);
    return extractText(result);
}

/**
 * Generate content with automatic backend fallback + retry for 429.
 */
async function generateWithFallback(prompt: string, maxRetries = 2): Promise<string> {
    const backend = ensureInitialized();
    if (!backend) throw new Error('No AI backend available');

    // Attempt with active backend
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const text =
                _activeBackend === 'firebase'
                    ? await generateViaFirebase(prompt)
                    : await generateViaDirect(prompt);

            if (text) return text;
            throw new Error('Empty response from model');
        } catch (e: any) {
            if (__DEV__) {
                console.error(`[NoorAI] ❌ [${_activeBackend}] Attempt ${attempt + 1}/${maxRetries + 1}:`, e?.message);
            }

            // If this is a config error on Firebase, switch to direct backend
            if (_activeBackend === 'firebase' && isConfigError(e)) {
                if (__DEV__) console.log('[NoorAI] 🔄 Firebase 403/404 — switching to direct SDK');
                _activeBackend = 'direct';

                // Ensure direct backend is ready
                if (!_directModel) initDirectBackend();

                if (_directModel) {
                    // Retry immediately with direct backend (reset attempts)
                    attempt = -1; // will become 0 on next iteration
                    continue;
                }
                throw e; // direct also not available
            }

            // Rate limit — retry with backoff
            if (isRateLimitError(e) && attempt < maxRetries) {
                const delay = Math.pow(2, attempt + 1) * 1000;
                if (__DEV__) console.warn(`[NoorAI] ⏳ Rate limited, retrying in ${delay / 1000}s`);
                await new Promise((r) => setTimeout(r, delay));
                continue;
            }

            // Final attempt or non-retryable error
            if (attempt >= maxRetries) throw e;
        }
    }

    return '';
}

// ═══════════════════════════════════════════════════════════════
// PROMPT BUILDING
// ═══════════════════════════════════════════════════════════════

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
 * When using the direct SDK (which has systemInstruction built-in),
 * we skip the system prompt from the user content.
 */
function buildPrompt(
    question: string,
    conversationHistory: NoorMessage[],
    tafsirContext?: string,
    verseContext?: VerseContext,
): string {
    // For direct backend, system prompt is already in the model config
    let prompt = _activeBackend === 'direct' ? '' : NOOR_SYSTEM_PROMPT;

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
        const truncated =
            cleaned.length > MAX_TAFSIR_CHARS ? cleaned.slice(0, MAX_TAFSIR_CHARS) + '...' : cleaned;
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

    return prompt.trim();
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
        /* ignore */
    }
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

    const backend = ensureInitialized();
    if (!backend) {
        return {
            answer: 'I need an internet connection to help you. Please check your connection and try again.',
            cached: false,
        };
    }

    const prompt = buildPrompt(question, conversationHistory, tafsirContext, verseContext);

    try {
        const text = await generateWithFallback(prompt);

        if (!text) {
            return {
                answer: "I wasn't able to generate a response. Please try again.",
                cached: false,
            };
        }

        // Cache first-message responses
        if (conversationHistory.length === 0) {
            const cacheKey = buildCacheKey(question, verseContext);
            await setCache(cacheKey, text);
        }

        if (__DEV__) {
            console.log(`[NoorAI] ✅ Response generated via ${_activeBackend} backend`);
        }

        return { answer: text, cached: false };
    } catch (e: any) {
        const errMsg = (e?.message || '').toLowerCase();

        if (__DEV__) {
            console.error('[NoorAI] ❌ FINAL ERROR:');
            console.error('[NoorAI]   message:', e?.message);
            console.error('[NoorAI]   backend:', _activeBackend);
            try {
                console.error('[NoorAI]   JSON:', JSON.stringify(e, null, 2));
            } catch { }
        }

        if (isRateLimitError(e)) {
            return {
                answer: "I'm receiving a lot of questions right now. Please try again in a moment! 🤲",
                cached: false,
            };
        }

        return {
            answer: `Something went wrong. Please check your connection and try again.${__DEV__ ? '\n\nDEBUG: ' + (e?.message || 'unknown error') : ''}`,
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
 * Check if Noor AI is available (any backend initialized).
 */
export function isNoorAvailable(): boolean {
    return ensureInitialized() !== null;
}

/**
 * Get the currently active backend name (for diagnostics).
 */
export function getActiveBackend(): string {
    return _activeBackend || 'none';
}
