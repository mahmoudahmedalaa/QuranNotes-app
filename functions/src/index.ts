/**
 * Firebase Cloud Functions for QuranNotes
 *
 * Security hardening functions:
 * 1. explainVerse — Server-side proxy for OpenAI API (keeps API key out of client)
 * 2. onUserDeleted — Cascade-deletes all user data when a Firebase Auth account is deleted
 */

import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

export { askNoorRagV1 } from "./noor-rag/callable";

admin.initializeApp();
const db = admin.firestore();

// ─── 1. OpenAI Proxy — Server-Side Verse Explanation ────────────────
// Keeps the OpenAI API key on the server, never shipped to the client.
// The client calls this function instead of OpenAI directly.

interface ExplainVerseRequest {
    arabicText: string;
    translation: string;
    surahName: string;
    verseNumber: number;
}

export const explainVerse = functions.https.onCall(
    async (
        data: ExplainVerseRequest,
        context: functions.https.CallableContext
    ) => {
        // Require authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                "unauthenticated",
                "You must be signed in to use AI explanations."
            );
        }

        // Enforce App Check if configured (blocks requests from non-genuine apps)
        // Uncomment when App Check is enabled:
        // if (context.app == undefined) {
        //   throw new functions.https.HttpsError(
        //     "failed-precondition",
        //     "App Check token is missing."
        //   );
        // }

        const { arabicText, translation, surahName, verseNumber } = data;

        // Validate input
        if (!arabicText || !translation || !surahName || !verseNumber) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "Missing required fields: arabicText, translation, surahName, verseNumber"
            );
        }

        if (typeof verseNumber !== "number" || verseNumber < 1) {
            throw new functions.https.HttpsError(
                "invalid-argument",
                "verseNumber must be a positive number"
            );
        }

        // Rate limiting: max 30 requests per user per hour
        const uid = context.auth.uid;
        const rateLimitRef = db.collection("_rateLimits").doc(uid);
        const now = Date.now();
        const oneHourAgo = now - 3600000;

        const rateLimitDoc = await rateLimitRef.get();
        if (rateLimitDoc.exists) {
            const data = rateLimitDoc.data();
            const requests: number[] = (data?.requests || [])
                .filter((ts: number) => ts > oneHourAgo);

            if (requests.length >= 30) {
                throw new functions.https.HttpsError(
                    "resource-exhausted",
                    "Too many requests. Please try again later."
                );
            }

            requests.push(now);
            await rateLimitRef.set({ requests });
        } else {
            await rateLimitRef.set({ requests: [now] });
        }

        // Get the OpenAI API key from Firebase environment config
        const apiKey = process.env.OPENAI_API_KEY ||
            functions.config().openai?.key;

        if (!apiKey) {
            functions.logger.error("OpenAI API key not configured");
            throw new functions.https.HttpsError(
                "internal",
                "AI service is not configured."
            );
        }

        // Build the prompt
        const prompt = `You are a knowledgeable Islamic scholar providing brief, accessible tafseer (explanation) of Quranic verses.

Verse: ${surahName}, Verse ${verseNumber}
Arabic: ${arabicText}
Translation: ${translation}

Provide a clear, concise explanation (3-5 paragraphs) covering:
1. Context (when/why this verse was revealed, if known)
2. Core meaning and lessons
3. How to apply this verse in daily life

Keep the tone warm, accessible, and respectful. Use simple language. Include relevant hadith references if applicable. Do NOT include the Arabic text or translation in your response — just the explanation.`;

        // Call OpenAI
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: "You are a knowledgeable Islamic scholar providing tafseer of Quranic verses.",
                        },
                        { role: "user", content: prompt },
                    ],
                    temperature: 0.7,
                    max_tokens: 1024,
                }),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                functions.logger.error("OpenAI API error:", response.status, errorBody);

                if (response.status === 429) {
                    throw new functions.https.HttpsError(
                        "resource-exhausted",
                        "AI quota exceeded. Please try again later."
                    );
                }

                throw new functions.https.HttpsError(
                    "internal",
                    "AI service is temporarily unavailable."
                );
            }

            const responseData = await response.json();
            const text = responseData.choices?.[0]?.message?.content ||
                "Unable to generate explanation. Please try again.";

            return { explanation: text };
        } catch (error) {
            // Re-throw HttpsErrors as-is
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }

            functions.logger.error("Unexpected error calling OpenAI:", error);
            throw new functions.https.HttpsError(
                "internal",
                "An unexpected error occurred."
            );
        }
    }
);

// ─── 2. Account Deletion Cascade ────────────────────────────────────
// Triggered automatically when a Firebase Auth user is deleted.
// Deletes all user data from Firestore collections — guaranteed server-side.

export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
    const uid = user.uid;
    functions.logger.info(`Deleting all data for user: ${uid}`);

    const collectionsToClean = ["notes", "recordings", "folders"];
    const batch = db.batch();
    let totalDeleted = 0;
    let hasPendingDeletes = false;

    for (const collectionName of collectionsToClean) {
        try {
            const snapshot = await db
                .collection(collectionName)
                .where("userId", "==", uid)
                .get();

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
                totalDeleted++;
                hasPendingDeletes = true;
            });
        } catch (error) {
            functions.logger.error(
                `Error querying ${collectionName} for user ${uid}:`,
                error
            );
        }
    }

    // Also clean up rate limit entries
    try {
        const rateLimitRef = db.collection("_rateLimits").doc(uid);
        batch.delete(rateLimitRef);
        hasPendingDeletes = true;
    } catch (error) {
        functions.logger.warn("Error deleting rate limit doc:", error);
    }

    // Noor's validated context and subject pseudonym index are user-scoped.
    batch.delete(db.collection("noorConversationState").doc(uid));
    batch.delete(db.collection("noorTelemetrySubjects").doc(uid));
    hasPendingDeletes = true;

    if (hasPendingDeletes) {
        await batch.commit();
        functions.logger.info(
            `Deleted ${totalDeleted} documents for user ${uid}`
        );
    } else {
        functions.logger.info(`No documents found for user ${uid}`);
    }
});
