/**
 * askSheikh — Trusted Sheikh RAG Cloud Function
 *
 * Answers cross-Quran questions by:
 *  1. Enforcing auth + free-tier daily limit (3 questions/day for non-premium)
 *  2. Embedding the question with Vertex AI text-embedding-004 (via @google/genai)
 *  3. Running a vector similarity search on the tafsir_embeddings collection
 *  4. Building a strict "no-invention" prompt from the retrieved Tafsir chunks
 *  5. Generating the answer with Gemini 2.0 Flash on Vertex AI
 *
 * Returns: { answer: string, citations: Citation[] }
 *
 * NOTE: Uses @google/genai with { vertexai: true } — the same pattern as
 * the Phase 1 embed_tafsir.ts script — for both embedding and generation.
 */

import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { GoogleGenAI } from '@google/genai';

// ── Constants ───────────────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-2.0-flash-001';
const EMBEDDING_MODEL = 'text-embedding-004';
const FREE_DAILY_LIMIT = 3;
const VECTOR_SEARCH_LIMIT = 5;
const GCP_PROJECT = 'qurannotes-9f7a1';
const GCP_LOCATION = 'us-central1';

// ── Types ────────────────────────────────────────────────────────────────────────
interface AskSheikhRequest {
    question: string;
}

interface Citation {
    surah: number;
    verse_start: number;
    verse_end: number;
}

// ── Lazy Vertex AI client ─────────────────────────────────────────────────────────
// Instantiated once per cold start. Uses ADC — no service account key needed
// in Cloud Functions (runs as the Functions service account automatically).
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
    if (!_ai) {
        _ai = new GoogleGenAI({
            vertexai: true,
            project: GCP_PROJECT,
            location: GCP_LOCATION,
        });
    }
    return _ai;
}

// ── Main Function ─────────────────────────────────────────────────────────────────
export const askSheikh = functions.https.onCall(
    async (
        data: AskSheikhRequest,
        context: functions.https.CallableContext
    ) => {
        // ── 1. Auth guard ─────────────────────────────────────────────────────────
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'You must be signed in to use Trusted Sheikh.'
            );
        }
        const uid = context.auth.uid;

        // ── 2. Input validation ───────────────────────────────────────────────────
        const question = (data?.question ?? '').trim();
        if (!question) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'A question is required.'
            );
        }
        if (question.length > 500) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'Question must be 500 characters or less.'
            );
        }

        // ── 3. Free tier gate ─────────────────────────────────────────────────────
        // TODO (Phase 4): Replace with real RevenueCat server-side entitlement check.
        const isPremium = false;

        if (!isPremium) {
            const db = admin.firestore();
            const usageRef = db.collection('ai_usage').doc(uid);
            const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

            const usageSnap = await usageRef.get();
            const usage = usageSnap.data();

            if (usage?.date === today && usage?.count >= FREE_DAILY_LIMIT) {
                throw new functions.https.HttpsError(
                    'resource-exhausted',
                    'PAYWALL'
                );
            }

            // Increment counter atomically — resets each day
            const newCount = usage?.date === today ? (usage.count as number) + 1 : 1;
            await usageRef.set({ date: today, count: newCount });
        }

        // ── 4. Embed the question ─────────────────────────────────────────────────
        let questionVector: number[];
        try {
            const ai = getAI();
            const embedResult = await ai.models.embedContent({
                model: EMBEDDING_MODEL,
                contents: question,
            });

            if (!embedResult.embeddings?.[0]?.values) {
                throw new Error('Empty embedding returned from Vertex AI.');
            }
            questionVector = embedResult.embeddings[0].values;
        } catch (e) {
            functions.logger.error('[askSheikh] Embedding failed:', e);
            throw new functions.https.HttpsError(
                'internal',
                'Failed to process your question. Please try again.'
            );
        }

        // ── 5. Vector search on tafsir_embeddings ────────────────────────────────
        const db = admin.firestore();
        const collection = db.collection('tafsir_embeddings');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let results: any;
        try {
            const vectorQuery = collection.findNearest({
                vectorField: 'embedding',
                queryVector: FieldValue.vector(questionVector),
                limit: VECTOR_SEARCH_LIMIT,
                distanceMeasure: 'COSINE',
            });
            results = await vectorQuery.get();
        } catch (e: any) {
            functions.logger.error('[askSheikh] Vector search failed:', e);
            // gRPC code 9 = FAILED_PRECONDITION — usually means the index is missing/building
            if (e?.code === 9 || String(e?.message ?? '').toLowerCase().includes('index')) {
                throw new functions.https.HttpsError(
                    'failed-precondition',
                    'The search index is still building. Please try again in a few minutes.'
                );
            }
            throw new functions.https.HttpsError(
                'internal',
                'Search service temporarily unavailable.'
            );
        }

        if (results.empty) {
            return {
                answer: "I couldn't find relevant information in the Quran or Tafsir to answer this question.",
                citations: [] as Citation[],
            };
        }

        // ── 6. Build context from retrieved chunks ───────────────────────────────
        const citations: Citation[] = [];
        const contextChunks = results.docs
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((doc: any) => {
                const d = doc.data();
                citations.push({
                    surah: d.surah as number,
                    verse_start: d.verse_start as number,
                    verse_end: d.verse_end as number,
                });
                return `[Surah ${d.surah}, Verses ${d.verse_start}–${d.verse_end}]:\n${d.text as string}`;
            })
            .join('\n\n---\n\n');

        // ── 7. Strict "no-invention" system prompt ───────────────────────────────
        const systemInstruction = `You are a knowledgeable Islamic scholar assistant for the QuranNotes app.
Your ONLY source of information is the Tafsir context below (from Ibn Kathir's Tafsir Al-Quran Al-Azim).

Rules you MUST follow without exception:
- ONLY answer using information explicitly found in the provided context.
- If the answer is not present, respond exactly: "I don't have information on this specific topic from the Quran and Tafsir."
- Do NOT speculate, extrapolate, or use knowledge outside this context.
- Do NOT invent hadith, scholars' opinions, or Quranic references not in the context.
- Reference the Surah and verse numbers naturally in your answer.
- Be concise (4–6 sentences), clear, and respectful in tone.
- Always respond in English.

TAFSIR CONTEXT (Ibn Kathir):
${contextChunks}`;

        // ── 8. Generate answer with Gemini on Vertex AI ──────────────────────────
        let answer: string;
        try {
            const ai = getAI();
            const response = await ai.models.generateContent({
                model: GEMINI_MODEL,
                contents: question,
                config: {
                    systemInstruction,
                    maxOutputTokens: 512,
                    temperature: 0.2, // Low temp for factual, grounded answers
                },
            });

            answer = response.text?.trim() ?? "I couldn't generate an answer. Please try again.";
        } catch (e) {
            functions.logger.error('[askSheikh] Gemini generation failed:', e);
            throw new functions.https.HttpsError(
                'internal',
                'AI service temporarily unavailable. Please try again.'
            );
        }

        functions.logger.info(
            `[askSheikh] Success uid=${uid} q="${question.slice(0, 60)}" citations=${citations.length}`
        );

        return { answer, citations };
    }
);
