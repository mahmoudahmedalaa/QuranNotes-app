# Case Study: Building a RAG-Based "Trusted Sheikh" AI for QuranNotes

> **Status:** Phase 1 Complete (Vectorization), Phase 2 In Progress  
> **Author:** Mahmoud Alaaeldin  
> **Stack:** React Native (Expo) + Firebase + Google Vertex AI + Firestore Vector Search

---

## The Vision

We wanted to build an AI that doesn't hallucinate. Every Quran app on the market either has a generic ChatGPT wrapper that can make things up, or nothing at all. We wanted something fundamentally different:

> *A "Trusted Sheikh" — an AI assistant that can only answer from verified classical Islamic scholarship. If the answer isn't in the Quran or Tafsir, it says so. No improvisation.*

This is called a **RAG (Retrieval-Augmented Generation)** system, and it's the gold standard for high-trust AI.

---

## What is an Embeddings Engine?

Before we explain the architecture, here's the concept explained without jargon:

### The Library Analogy

Imagine you have a massive library with thousands of books. When someone asks a question, instead of reading every single book, a smart librarian can find the 3-4 most *relevant* books almost instantly and then read only those to answer you.

**Embeddings** are the secret. An embeddings engine converts any piece of text into a list of ~768 floating-point numbers (called a *vector*). Think of it as a unique mathematical "fingerprint" for the meaning (not the exact words) of that text.

```
"The mercy of Allah encompasses all things" 
        ↓  Embedding Engine
[0.23, -0.91, 0.44, 0.07, -0.18, ...]  (768 numbers)
```

The magic: two sentences that *mean the same thing* will have vectors that are numerically *close to each other*, even if they use completely different words. "Allah is merciful" and "God shows compassion" will be near each other in this mathematical space.

**A Vector Database** stores these fingerprints. When a user asks a question, we:
1. Generate the vector fingerprint for their question.
2. Find the Tafsir chunks whose vectors are *closest* to it.
3. Show those chunks to the AI as context before asking it to answer.

This is why the AI can only answer from our data — it physically has no other information to work with.

---

## Architecture Overview

```
USER QUESTION
      │
      ▼
[Firebase Cloud Function]
      │
      ├─── 1. EMBED: Convert question to vector (Vertex AI text-embedding-004)
      │
      ├─── 2. SEARCH: Find top-5 closest Tafsir chunks (Firestore Vector Search)
      │
      ├─── 3. PROMPT: Inject chunks into a strict system prompt
      │         "Answer ONLY using the provided context. If the answer is not 
      │         found, say 'I don't have information on this from the Quran.'"
      │
      └─── 4. GENERATE: Stream answer from Gemini AI back to the user
                │
                ▼
           REACT NATIVE UI
           (Chat bubbles + Verse citations)
```

---

## What We Actually Built

### Phase 1: The Knowledge Base (Complete ✅)

#### The Data Source
We already had 45MB of **Ibn Kathir Tafsir** bundled inside the app (it powers the existing Tafsir reading feature). Ibn Kathir is one of the most respected and widely-read classical Tafsir in Islamic scholarship — using it means our AI is grounded in centuries of verified scholarship.

The data lives in: `ios/src/features/tafsir/data/tafsir/ibn_kathir/` as 114 JSON files (one per Surah), each structured with verse-grouped text:
```json
{
  "verses": {
    "1": {
      "text": "In the Name of Allah, the Most Gracious, the Most Merciful. ...",
      "range": [1, 1]
    }
  }
}
```

#### The Vectorization Pipeline
We wrote a script (`ios/functions/scripts/embed_tafsir.ts`) that:
1. Reads all 114 Surah JSON files
2. For each verse group, sends the text to **Google Vertex AI `text-embedding-004`**
3. Gets back a 768-number vector (the fingerprint)
4. Writes the vector + metadata to a **Firestore collection** (`tafsir_embeddings`)

Each Firestore document looks like:
```json
{
  "surah": 2,
  "verse_start": 1,
  "verse_end": 7,
  "text": "Alif-Lam-Mim. This is the Book about which there is no doubt...",
  "embedding": [0.12, -0.45, 0.87, ...]  // 768 numbers
}
```

#### The Smart Technical Decisions

| Decision | Alternative Considered | Why We Chose This |
|---|---|---|
| **Firestore Vector Search** | Pinecone (external paid DB) | Already in stack. No new vendor, no extra billing account |
| **Vertex AI (IAM Auth)** | Gemini consumer API (API Key) | API keys can be leaked/geo-blocked. IAM is cryptographic, immune to both |
| **Bundled Tafsir dataset** | Fetching from external API | Zero latency, works offline, zero per-call data cost |
| **`text-embedding-004`** | OpenAI `text-embedding-3-small` | Native to our Google stack. No cross-vendor API calls |
| **Vertex AI User role** added to `firebase-adminsdk` | Creating a new service account | One account, one permission set, less surface area for mistakes |

---

## Why This is a Flagship Feature

1. **Trust & Safety** — The "No-Invention" policy (AI refuses to go outside the corpus) is a direct competitive advantage. No other consumer Quran app has this guarantee.

2. **Scalable** — We can expand the knowledge base by adding hadith collections, scholarly fatawa, or the full Arabic text without changing any application code. Just run the vectorization script on new data.

3. **Cost-Efficient** — Vectorization is a one-time cost (run once, embed everything). Query costs are pennies. No ongoing database subscription.

4. **Fully Private** — All data stays within Firebase/GCP. No user queries leave your Google Cloud project boundary.

---

## What's Next (Phase 2 & 3)

### Phase 2: The Backend (Firebase Cloud Function)
Build the `askSheikh` callable function that:
- Accepts a user question
- Runs vector similarity search on `tafsir_embeddings`
- Builds the grounded prompt
- Streams the Gemini response back

### Phase 3: The React Native UI
Build the chat screen in the app:
- Chat bubble UI with streaming text
- Tap-able verse citations (e.g., "Al-Baqarah 2:255") that navigate to `QuranReaderScreen`
- Free tier: 3 queries/day gated by Firestore counter
- Premium: unlimited via RevenueCat paywall

---

## The Numbers (Approximate)

- **Tafsir chunks vectorized:** ~3,000–5,000 documents
- **Embedding dimensions:** 768 per chunk
- **One-time vectorization cost:** ~$0.002 (virtually free on Vertex AI)
- **Per-query cost:** ~$0.001 embedding + ~$0.01 Gemini generation = under 2 cents/query
- **Firestore reads per query:** 1 vector search = 5 document reads = negligible

---

*This document serves as a technical reference and potential case study for future blog posts or developer talks. For implementation continuity, see the handover document.*
