# Firebase Vertex AI Configuration & Setup Guide

This document provides a detailed, step-by-step guide on how we configured Firebase Vertex AI to power the AI features (Noor AI, Tadabbur, and Tafsir) in QuranNotes. We successfully migrated to the official Firebase AI SDK and `gemini-2.5-flash` model after overcoming deprecation and access issues.

## History & The Problem
Initially, the app relied on older Gemini models (`gemini-1.5-flash` and `gemini-2.0-flash`). However:
1. `gemini-1.5-flash` was fully retired, leading to `HTTP 404: models are retired` errors.
2. `gemini-2.0-flash` faced an upcoming shutdown (June 1, 2026), and calls using the generic Direct AI backend or incorrectly matched configuration resulted in `HTTP 403: Your project has been denied access.` errors.
3. The codebase was scattered with mixed logic (some using `GoogleAIBackend()`, some using `VertexAIBackend()`), causing inconsistencies in authentication and App Check propagation.

## The Solution
We standardized the entire AI infrastructure on Firebase Vertex AI.

### 1. Unified Model Requirements
We migrated every AI feature to use the **`gemini-2.5-flash`** model. This is the recommended long-term model supported by the Firebase Vertex AI SDK, offering fast inference times and stable multimodal support.

### 2. Standardized Backend (`VertexAIBackend`)
We centralized the Firebase AI Logic backend to strictly use `VertexAIBackend()`, replacing instances of `GoogleAIBackend()`.

* **`GoogleAIBackend`**: Corresponds to the standard Google Gemini API (AI Studio).
* **`VertexAIBackend`**: Explicitly maps to Firebase Vertex AI built on Google Cloud Vertex AI, which provides enterprise-grade privacy and built-in integration with Firebase App Check.

### Code Standardization

All Firebase AI initializations now follow this exact pattern:
```typescript
import { getAI, getGenerativeModel, VertexAIBackend } from 'firebase/ai';

const app = getApp(); // Access initialized Firebase app
const ai = getAI(app, { backend: new VertexAIBackend() });
const _model = getGenerativeModel(ai, { model: 'gemini-2.5-flash' });
```

The fallback method (when direct SDK is used during development or offline testing) uses:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(apiKey);
const _directModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
```

## Step-by-Step Configuration Checklist

If you ever need to set this up from scratch or verify the project's health:

### Step 1: Firebase Console Check
1. Go to your **Firebase Project Console**.
2. Navigate to **Build > Vertex AI**.
3. Ensure the service is enabled and tied to a Google Cloud project with billing enabled (pay-as-you-go).

### Step 2: Ensure API Keys
Your environment must expose the relevant SDK keys. In Expo/React Native, this means:
* `EXPO_PUBLIC_FIREBASE_API_KEY` (Used implicitly by the Firebase app initialization).
* `EXPO_PUBLIC_GEMINI_API_KEY` (Optional string used for the direct fallback SDK logic).

### Step 3: Polyfill for React Native Hermes
Because React Native's Hermes engine does not natively support `AbortSignal.any()`, the Firebase AI SDK will crash upon generation attempts unless polyfilled.
Ensure this file exists and is imported *before* Firebase AI:
`src/core/polyfills/abortSignalAny.ts`

```typescript
if (!AbortSignal.any) {
  AbortSignal.any = function(signals) {
    const controller = new AbortController();
    signals.forEach(signal => {
      if (signal.aborted) controller.abort(signal.reason);
      else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
    });
    return controller.signal;
  };
}
```

### Step 4: Verify App Check Compatibility (Optional but Recommended)
Using `VertexAIBackend` automatically enforces any Firebase App Check rules you have established in the console. Ensure App Check is correctly initialized in `src/core/firebase/appCheck.ts` to prevent "denied access" issues in production.

## Troubleshooting

- **`[404] Models are retired`**: The model string in `getGenerativeModel` is old. Update to `gemini-2.5-flash`.
- **`[403] Your project has been denied access`**: 
    1. Firebase ML / Vertex API is not enabled in the Google Cloud Console.
    2. Missing explicit Billing connection in Google Cloud.
    3. You are incorrectly using `GoogleAIBackend()` instead of `VertexAIBackend()`.
- **`AbortError` immediately upon submitting a prompt**: Missing the `AbortSignal.any()` polyfill in your React Native environment.

---
*Created April 9, 2026. This setup resolved a major blocker where Gemini API migration policies caused both 403 and 404 disruptions across Noor AI, Tadabbur, and Tafsir services.*
