# Handover Document: "Trusted Sheikh" AI Q&A — Phase 2

> **For the next AI agent continuing this feature.**  
> **Read this entire document before writing a single line of code.**

---

## Project Context

- **App:** QuranNotes (React Native + Expo)
- **Platform:** iOS + Android
- **Backend:** Firebase Cloud Functions (Node 18, TypeScript)
- **Database:** Firebase Firestore
- **AI:** Google Vertex AI (Gemini models)
- **Payments:** RevenueCat
- **Project ID:** `qurannotes-9f7a1`
- **Functions Directory:** `ios/functions/`
- **Main App Source:** `ios/src/`

---

## What Phase 1 Accomplished (Already Done — Do NOT redo)

The entire 45MB Ibn Kathir Tafsir dataset has been vectorized and is being written to Firestore. The vectorization script is at:

`ios/functions/scripts/embed_tafsir.ts`

It reads the JSON files at `ios/src/features/tafsir/data/tafsir/ibn_kathir/`, generates embeddings via **Vertex AI `text-embedding-004`**, and upserts them into the Firestore collection **`tafsir_embeddings`**.

Each document in that collection has this structure:
```json
{
  "surah": 2,
  "verse_start": 255,
  "verse_end": 257,
  "text": "Allah! La ilaha illa Huwa (none has the right to be worshipped but He)...",
  "embedding": FieldValue.vector([0.12, -0.45, ...])
}
```

**Do not run the script again.** It is idempotent (uses `set()` not `add()`), but it will waste Vertex AI quota unnecessarily.

---

## Relationship to Existing Verse AI Tafsir Feature (Important Context)

There is already a live AI feature in the app. **Do not confuse them.**

### The Existing Feature: `TafsirService.ts`
- File: `ios/src/features/tafsir/domain/TafsirService.ts`
- It runs **client-side** using `firebase/ai` with `GoogleAIBackend()` (consumer Gemini tier)
- It takes the **single Tafsir text already on screen** for that verse and sends it directly to Gemini
- Functions: `summarizeTafsir()` (explains a verse in plain English) and `askAboutVerse()` (Q&A about one verse)
- It is **NOT RAG** — it is a "stuffed context" approach with no vector database
- It has `AsyncStorage` caching keyed by Surah + verse number

### The New Feature: Trusted Sheikh
- Runs **server-side** via Firebase Cloud Function (Vertex AI, enterprise tier)
- Does a **semantic vector search** across the entire 45MB Tafsir corpus
- Answers cross-Quran questions ("Where in the Quran does X appear?") — not just per-verse
- Must be streamed back to the client from the Cloud Function

### UX Flow: They complement each other perfectly
1. User reads a verse → taps "Explain" → **Existing Verse AI** gives a laser-focused per-verse summary
2. User has a broader question → opens **Trusted Sheikh chat** → semantic search across all 114 Surahs answers it

### What NOT to change
**Do not touch or rewrite `TafsirService.ts`** — it is live, working, and cached. The Trusted Sheikh is a new screen/feature, not a replacement.

### Future alignment note (Non-blocking for Phase 2 or 3)
The existing feature calls Gemini client-side with a consumer API key embedded in the app. The Trusted Sheikh uses server-side Vertex AI with IAM. **Phase 4 (below) will unify these.** Skip it for now.

---

## Phase 4: Unify the Verse AI into the RAG Architecture

### Goal
Replace the client-side `TafsirService.ts` with two new server-side Firebase Cloud Functions that use the same Vertex AI + Firestore Vector infrastructure we built for the Trusted Sheikh.

### Why This Is Worth Doing
| Current Verse AI | After Unification |
|---|---|
| API key in the app bundle (security risk) | IAM auth — nothing to steal |
| Consumer Gemini tier (rate limited) | Vertex AI enterprise (no rate limits) |
| Soft system prompt — no enforcement mechanism | Grounded in vector DB — physically cannot hallucinate |
| Caches per-device in AsyncStorage | Can cache server-side in Firestore (shared across all users) |
| Separate billing from Vertex AI | Single billing account |

### What to Build

#### Function 1: `summarizeVerse`
Replace `summarizeTafsir()` in `TafsirService.ts`.

```typescript
// Input
{ surahNumber: number, verseNumber: number, tafsirSource: string }

// Logic
// 1. Query tafsir_embeddings where surah == surahNumber AND verse_start <= verseNumber AND verse_end >= verseNumber
// 2. Retrieve the matching Tafsir chunk text
// 3. Pass it to Gemini with the strict summarization prompt
// 4. Return { summary: string }
```

#### Function 2: `askAboutVerse`
Replace `askAboutVerse()` in `TafsirService.ts`.

```typescript
// Input
{ surahNumber: number, verseNumber: number, question: string, tafsirSource: string }

// Logic
// 1. First: direct Firestore query for the verse's chunk (by surah + verse range)
// 2. Optionally: run a vector search with the question to find related cross-verse context (bonus)
// 3. Build strict grounded prompt
// 4. Return { answer: string }
```

Note: For these two functions, a **direct Firestore query** (not vector search) on `surah == X` and `verse_start <= Y` is sufficient — we already know which verse the user is on. Reserve vector search for the Trusted Sheikh's cross-Quran queries.

### Migration Steps (In Order)
1. Build and deploy `summarizeVerse` and `askAboutVerse` Cloud Functions
2. Update `TafsirService.ts` to call these functions via `httpsCallable` instead of calling Gemini directly
3. Delete the local Gemini model initialization (`getModel()`, `generateWithRetry()`, etc.) from `TafsirService.ts`
4. Keep the `AsyncStorage` caching layer — just cache the function response instead of the AI response
5. Test both functions match the existing UX (same screen, same UI — just different data path)
6. Remove `firebase/ai` and `@firebase/ai` from `ios/package.json` if no other features use it

### What NOT to Change
- The UI of the Tafsir screen stays exactly the same — users notice nothing
- The `TafsirSource` enum and `TAFSIR_SOURCE_LABELS` stay the same
- The `AiQueryResult` return type stays the same — just the implementation underneath changes

---

## What You Need to Build (Phase 2)

### Goal: A Firebase Callable Function named `askSheikh`

It must:
1. Accept a user's natural-language question
2. Verify the user's premium status via RevenueCat entitlement OR enforce a free-tier counter
3. Convert the question to a vector embedding (Vertex AI)
4. Run a **Firestore vector similarity search** against `tafsir_embeddings`
5. Build a strict "no-invention" system prompt with the retrieved context
6. Call Gemini and stream the response back to the client

---

## Step-by-Step Implementation Guide

### Step 1: Enable Firestore Vector Index

Before the function can do vector search, you MUST create a vector index via the Firebase CLI. Run:

```bash
gcloud firestore indexes composite create \
  --project=qurannotes-9f7a1 \
  --collection-group=tafsir_embeddings \
  --query-scope=COLLECTION \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat": {}}'
```

Or via the Firebase console: Firestore → Indexes → Composite → Add → Collection: `tafsir_embeddings`, Field: `embedding`, Type: `Vector`.

### Step 2: The Cloud Function

Create `ios/functions/src/askSheikh.ts`:

```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { FieldValue, VectorQuery } from 'firebase-admin/firestore';
import { getVertexAI } from 'firebase-admin/vertexai'; // NOTE: admin must be >=13

// Important: admin.initializeApp() is called once in index.ts
const db = admin.firestore();

interface AskSheikhRequest {
  question: string;
}

export const askSheikh = functions.https.onCall(async (request) => {
  const { question } = request.data as AskSheikhRequest;
  const uid = request.auth?.uid;

  if (!uid) throw new functions.https.HttpsError('unauthenticated', 'Must be logged in.');
  if (!question?.trim()) throw new functions.https.HttpsError('invalid-argument', 'Question is required.');

  // --- FREE TIER GATE ---
  const usageRef = db.collection('ai_usage').doc(uid);
  const usageSnap = await usageRef.get();
  const today = new Date().toISOString().split('T')[0];
  const usage = usageSnap.data();
  
  const isPremium = false; // TODO: integrate RevenueCat server-side check here
  
  if (!isPremium) {
    if (usage?.date === today && usage?.count >= 3) {
      throw new functions.https.HttpsError('resource-exhausted', 'PAYWALL');
    }
    await usageRef.set({ date: today, count: (usage?.date === today ? usage.count + 1 : 1) });
  }

  // --- VERTEX AI SETUP ---
  const vertexai = getVertexAI(admin.app());
  
  // 1. EMBED the question
  const embeddingModel = vertexai.getGenerativeModel({ model: 'text-embedding-004' });
  const embedResult = await embeddingModel.embedContent(question);
  const questionVector = embedResult.embedding.values;

  // 2. VECTOR SEARCH against tafsir_embeddings
  const collection = db.collection('tafsir_embeddings');
  const vectorQuery = collection.findNearest({
    vectorField: 'embedding',
    queryVector: FieldValue.vector(questionVector),
    limit: 5,
    distanceMeasure: 'COSINE'
  });
  const results = await vectorQuery.get();

  if (results.empty) {
    return { answer: "I couldn't find relevant information in the Quran or Tafsir to answer this question.", citations: [] };
  }

  // 3. BUILD CONTEXT from retrieved chunks
  const citations: Array<{ surah: number, verse_start: number, verse_end: number }> = [];
  const contextChunks = results.docs.map(doc => {
    const data = doc.data();
    citations.push({ surah: data.surah, verse_start: data.verse_start, verse_end: data.verse_end });
    return `[Surah ${data.surah}, Verses ${data.verse_start}-${data.verse_end}]:\n${data.text}`;
  }).join('\n\n---\n\n');

  // 4. STRICT SYSTEM PROMPT (the "No-Invention" rule)
  const systemPrompt = `You are a knowledgeable Islamic scholar assistant for the QuranNotes app. 
Your ONLY source of information is the Tafsir context provided below.
Rules you MUST follow:
- ONLY answer using information found in the provided context.
- If the answer is not present in the context, say: "I don't have information on this specific topic from the Quran and Tafsir."
- Do NOT speculate, extrapolate, or use knowledge outside of this context.
- When citing, reference the Surah and verse numbers naturally.
- Be concise, clear, and respectful.

TAFSIR CONTEXT:
${contextChunks}`;

  // 5. GENERATE answer with Gemini
  const generativeModel = vertexai.getGenerativeModel({ model: 'gemini-2.0-flash' });
  const chat = generativeModel.startChat({
    systemInstruction: { parts: [{ text: systemPrompt }] }
  });
  const response = await chat.sendMessage(question);
  const answer = response.response.text();

  return { answer, citations };
});
```

### Step 3: Register in index.ts

In `ios/functions/src/index.ts`, add:
```typescript
export { askSheikh } from './askSheikh';
```

---

## Phase 3: React Native UI (After Phase 2 Works)

Build `ios/src/features/ai-sheikh/screens/SheikhChatScreen.tsx`:

- Use `firebase/functions` `httpsCallable` to call `askSheikh`
- Render streaming text in chat bubbles (or simulate stream with state)
- Parse `citations` array from the response and render them as tappable chips
- On citation tap → navigate to `QuranReaderScreen` with `{ surahId, verseId }`
- Free limit hit → show RevenueCat paywall modal

---

## Codebase Conventions to Follow

- **Navigation:** React Navigation with a typed `RootStackParamList`
- **Styling:** No Tailwind. Use `StyleSheet.create()` with the app's dark/premium design
- **Colors:** Deep navy (`#0A1628`), gold accent (`#D4AF37`), white text — see design handbook
- **Firebase:** Use modular SDK (`firebase/firestore`, `firebase/functions`), not `firebase-admin` on the client
- **Premium checks on client:** Use `Purchases.getCustomerInfo()` from `react-native-purchases` (RevenueCat)
- **Error handling:** Every screen must handle `unauthenticated`, `resource-exhausted` (paywall trigger), and network errors gracefully

---

## Key Files to Know

| File | Purpose |
|---|---|
| `ios/functions/src/index.ts` | Cloud Functions entrypoint |
| `ios/functions/scripts/embed_tafsir.ts` | Phase 1 vectorization script (READ ONLY) |
| `ios/src/features/tafsir/` | Tafsir reader feature (reference for UI patterns) |
| `ios/src/features/ai-summary/` | Existing AI Tafsir summary (reference for AI function call patterns) |
| `ios/src/navigation/` | App navigation setup |
| `ios/.env` | Environment variables (contains Firebase config + Gemini key) |
| `ios/service-account.json` | GCP Service Account (NEVER commit this to git) |

---

## DO NOT

- Do NOT use the `@google/generative-ai` consumer package in functions — use `firebase-admin/vertexai` 
- Do NOT hardcode the Gemini model name in multiple places — use a constant
- Do NOT skip the free tier gate — it directly protects revenue
- Do NOT commit `service-account.json` or `.env` to git
- Do NOT run the embed_tafsir.ts script again — it is already done

---

*For full context and the business rationale behind this feature, read the case study at `docs/trusted-sheikh-rag-case-study.md`.*
