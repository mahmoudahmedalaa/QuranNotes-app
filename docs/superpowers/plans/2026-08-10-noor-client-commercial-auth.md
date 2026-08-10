# Noor Client, Commercial, and Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Noor and verse-level AI through `askNoorRagV1`, show safe cited answers, expose Lifetime/Annual/Monthly purchases, and ship friendly sign-up errors without importing unrelated dirty-checkout work.

**Architecture:** A single infrastructure adapter obtains Firebase Auth and native App Check tokens and speaks the Firebase callable protocol. Presentation consumes a typed result union and never inspects provider errors. RevenueCat remains the client purchase SDK and all three offering packages share one selector model.

**Tech Stack:** React Native, Expo native workflow, TypeScript, Firebase Compat Auth, React Native Firebase App Check 26.2.0, RevenueCat `react-native-purchases`, Jest/Testing Library.

---

## File map

- `src/core/firebase/AppCheckService.ts`: native App Attest/DeviceCheck initialization and token access.
- `src/features/noor-ai/infrastructure/NoorRemoteService.ts`: callable protocol, typed response validation, friendly transport errors.
- `src/features/noor-ai/domain/types.ts`: request/result/citation/message types shared by client features.
- `src/features/noor-ai/domain/NoorAIService.ts`: thin domain-facing facade over remote service; no model SDK.
- `src/features/noor-ai/presentation/NoorCitationList.tsx`: citation chips and deep links.
- `src/features/tafsir/domain/TafsirService.ts`: exact-verse requests through the same facade.
- `src/features/payments/presentation/paywallOfferUtils.ts`: three-plan selection and display utilities.
- `src/features/auth/presentation/authErrorMessage.ts`: safe auth code translator and current password policy.

### Task 1: Initialize native App Check and one authenticated callable transport

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `app.json`
- Create: `src/core/firebase/AppCheckService.ts`
- Create: `src/features/noor-ai/infrastructure/NoorRemoteService.ts`
- Test: `src/core/firebase/AppCheckService.test.ts`
- Test: `src/features/noor-ai/infrastructure/NoorRemoteService.test.ts`
- Modify: `jest.setup.js`

- [ ] **Step 1: Write the red transport test**

Mock Auth and App Check tokens and `fetch`. Assert the request is a POST to the `us-central1` `askNoorRagV1` endpoint, uses only allowed callable headers, has `{ data: request }`, and rejects malformed responses.

```ts
expect(fetch).toHaveBeenCalledWith(
  'https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1',
  expect.objectContaining({
    method: 'POST',
    headers: expect.objectContaining({
      Authorization: 'Bearer auth-token',
      'X-Firebase-AppCheck': 'app-check-token',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({ data: request }),
  }),
);
```

Also assert signed-out/auth-token failure, App Check initialization/token failure, and malformed callable error bodies produce safe transport codes and never call `fetch` without both required tokens.

- [ ] **Step 2: Install and configure App Check dependencies**

Run only after the disk gate is satisfied:

```bash
npm install @react-native-firebase/app@26.2.0 @react-native-firebase/app-check@26.2.0
```

Add both Expo config plugins to `app.json`. Production Apple provider is `appAttestWithDeviceCheckFallback`; development uses the debug provider with a debug token supplied through ignored local environment/build configuration, never source.

- [ ] **Step 3: Implement AppCheckService**

Expose:

```ts
export interface AppCheckTokenProvider {
  getToken(forceRefresh?: boolean): Promise<string>;
}

export async function initializeQuranNotesAppCheck(): Promise<void>;
export async function getQuranNotesAppCheckToken(forceRefresh?: boolean): Promise<string>;
```

`getQuranNotesAppCheckToken()` calls a concurrency-safe lazy initializer backed by one shared `initializationPromise`, so no separate bootstrap race exists. In production select `appAttestWithDeviceCheckFallback`; in development select `debug` and use the native debug-provider registration flow. Never place a debug token in an `EXPO_PUBLIC_` variable, source file, app bundle, or log written by QuranNotes code. Tests prove simultaneous token requests initialize once, provider selection follows `__DEV__`, initialization/token failure prevents `fetch`, and no token value is logged.

- [ ] **Step 4: Implement the callable protocol and response validator**

Use current `auth.currentUser.getIdToken()` plus the native App Check token. Apply a 25-second `AbortController` timeout. Per Firebase's raw callable wire protocol, a request is `{ data: NoorRequest }` and a successful HTTP response is exactly `{ result: NoorAnswer }`; validate `response.result` against the approved schema. Add exact fixtures that accept `result` and reject `data`, missing/extra success envelopes, malformed results, and `{ error: ... }` as a success. Map HTTP/callable errors to `signed_out`, `temporarily_unavailable`, or `invalid_response`; never return raw `message`, `details`, or stack data to UI.

- [ ] **Step 5: Run green and commit**

```bash
npm test -- src/core/firebase/AppCheckService.test.ts src/features/noor-ai/infrastructure/NoorRemoteService.test.ts --runInBand
npm run typecheck
git add package.json package-lock.json app.json src/core/firebase/AppCheckService.ts src/core/firebase/AppCheckService.test.ts src/features/noor-ai/infrastructure/NoorRemoteService.ts src/features/noor-ai/infrastructure/NoorRemoteService.test.ts jest.setup.js
git commit -m "feat(noor): add protected callable transport"
```

### Task 2: Replace the client Gemini brain with the typed remote facade

**Files:**
- Modify: `src/features/noor-ai/domain/types.ts`
- Verify generated: `src/features/noor-ai/domain/generatedContract.ts`
- Replace: `src/features/noor-ai/domain/NoorAIService.ts`
- Modify: `src/features/noor-ai/index.ts`
- Modify: `src/core/utils/validateEnvironment.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Test: `src/features/noor-ai/domain/NoorAIService.test.ts`

- [ ] **Step 1: Write red facade tests**

Assert bounded history conversion (`noor` → `assistant`), generated UUID request IDs, verse-context request selection, response status preservation, and no client caching of generated religious answers.

```ts
expect(remote.ask).toHaveBeenCalledWith(expect.objectContaining({
  mode: 'chat',
  question: 'What does the Quran teach about patience?',
  history: [{ role: 'assistant', content: 'Previous answer' }],
}));
```

- [ ] **Step 2: Define client contracts**

Import `NoorStatus`, `NoorCitation`, `NoorAnswer`, and `NoorRequest` from the generated contract. Add optional `citations`, `status`, and `nextResetAt` fields on persisted assistant messages. Keep the app-facing tafsir source names and convert them only at the request boundary. Run `node scripts/generate-noor-contract.js --check` in focused and final gates.

- [ ] **Step 3: Replace NoorAIService**

`askNoor()` calls `NoorRemoteService.ask()` and returns the typed backend answer. Remove system prompts, model initialization, retry/backoff, `stripToEnglish`, AsyncStorage response cache, direct/Firebase backend state, and diagnostic backend names. `getSuggestedQuestions()` remains deterministic local UI copy.

- [ ] **Step 4: Remove the direct Gemini dependency and environment requirement**

```bash
npm uninstall @google/generative-ai
```

Remove `EXPO_PUBLIC_GEMINI_API_KEY` from `validateEnvironment.ts`. Do not remove Firebase public client configuration keys.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/noor-ai/domain/NoorAIService.test.ts --runInBand
npm run typecheck
rg -n "@google/generative-ai|GoogleGenerativeAI|EXPO_PUBLIC_GEMINI_API_KEY|generateWithFallback|stripToEnglish" app src package.json
git add src/features/noor-ai src/core/utils/validateEnvironment.ts package.json package-lock.json
git commit -m "refactor(noor): use only governed backend"
```

Expected search: no matches in shipped app/runtime.

### Task 3: Render Noor citations and typed safe states

**Files:**
- Create: `src/features/noor-ai/presentation/NoorCitationList.tsx`
- Test: `src/features/noor-ai/presentation/NoorCitationList.test.tsx`
- Modify: `src/features/noor-ai/presentation/NoorChatBubble.tsx`
- Modify: `src/features/noor-ai/presentation/NoorAIScreen.tsx`
- Modify: `src/features/noor-ai/domain/NoorChatStore.ts`
- Modify: `src/features/noor-ai/domain/NoorConversationHistory.ts`
- Delete: `src/features/noor-ai/domain/NoorUsageService.ts`
- Test: `src/features/noor-ai/presentation/NoorAIScreen.test.tsx`

- [ ] **Step 1: Write red rendering/state tests**

Prove Ibn Kathir and Al-Sa'di labels/ranges render from metadata, a citation press navigates to `/surah/[id]` with the cited starting verse, and statuses render fixed copy. `not_entitled` opens the hard paywall, `quota_exceeded` requires and shows validated `nextResetAt`, `policy_refusal` and `insufficient_evidence` remain messages, and `temporarily_unavailable` shows a retry action.

- [ ] **Step 2: Implement citation UI**

Render compact accessible buttons labeled, for example, `Ibn Kathir · 2:255` or `Al-Sa'di · 2:51–55`. Use the citation's `sourceTitle`, `surah`, `verseStart`, and `verseEnd`; never parse citations from answer prose.

- [ ] **Step 3: Remove client quota authority and raw-error inspection**

Delete `NoorUsageService` after removing its imports from the screen. The screen renders only backend status; remove branches that detect `403`, `429`, provider names, Firebase Console instructions, or raw error text. Persist citations, status, and `nextResetAt` with assistant messages so restored conversations remain transparent.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/noor-ai/presentation/NoorCitationList.test.tsx src/features/noor-ai/presentation/NoorAIScreen.test.tsx --runInBand
npm run typecheck
git add src/features/noor-ai
git commit -m "feat(noor): show cited backend answers"
```

### Task 4: Route verse summaries and questions through exact retrieval

**Files:**
- Replace: `src/features/tafsir/domain/TafsirService.ts`
- Modify: `src/features/tafsir/domain/types.ts`
- Modify: `src/features/tafsir/index.ts`
- Modify: `src/features/tafsir/presentation/TafsirBottomSheet.tsx`
- Modify: `src/features/tafsir/presentation/AiQueryInput.tsx`
- Verify: `app/surah/[id].tsx`
- Delete: `src/features/tafsir/domain/TafsirUsageService.ts`
- Delete: `src/core/api/GeminiAPI.ts`
- Delete: `src/features/quran-reading/presentation/VerseTafseerModal.tsx`
- Test: `src/features/tafsir/domain/TafsirService.test.ts`
- Test: `src/features/tafsir/presentation/TafsirBottomSheet.test.tsx`

- [ ] **Step 1: Write red exact-request tests**

Assert summary sends `mode: 'verse_summary'` with source/surah/verse; question sends `mode: 'verse_question'` and the question; no Arabic commentary is stripped or sent by the client; Al-Sa'di response citation retains the Arabic-source identity.

- [ ] **Step 2: Replace TafsirService**

Keep the existing public function names to minimize UI churn, but ignore the local raw commentary parameters for AI transport. Convert `ibn_kathir`/`al_sadi` to server source IDs and return `AiQueryResult` containing `answer`, `status`, and `citations`. Remove `firebase/ai`, prompt construction, model retry, and generated-answer cache.

- [ ] **Step 3: Make the sheet server-metered and safe**

Remove all `TafsirUsageService` imports and delete the service. Let `not_entitled` navigate to paywall, `quota_exceeded` show validated `nextResetAt` reset copy, and other typed states render calm fixed text. Replace `Unlock Unlimited AI` and `unlimited AI-powered verse insights` copy with `Access Noor AI and verse explanations` plus the 50/day fair-use disclosure.

- [ ] **Step 4: Remove the dead unsafe alternate path**

After `rg` proves the legacy modal is not imported by runtime, delete `VerseTafseerModal.tsx` and `GeminiAPI.ts`. Coordinate with the backend task that removes `explainVerse` so no orphan export remains.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/tafsir/domain/TafsirService.test.ts src/features/tafsir/presentation/TafsirBottomSheet.test.tsx --runInBand
npm run typecheck
rg -n "GeminiAPI|VerseTafseerModal|firebase/ai|stripToEnglish|incrementUsage\('explanation'\)|incrementUsage\('question'\)" src/features/noor-ai src/features/tafsir src/core/api src/features/quran-reading
git add src/features/tafsir src/core/api src/features/quran-reading
git commit -m "refactor(tafsir): use exact governed retrieval"
```

### Task 5: Remove the remaining client-side Gemini path from Tadabbur

**Files:**
- Replace: `src/features/tadabbur/domain/TadabburAIService.ts`
- Test: `src/features/tadabbur/domain/TadabburAIService.test.ts`
- Modify: `src/features/tadabbur/infrastructure/TadabburContext.tsx` only if an obsolete availability branch must be removed
- Delete: `src/core/polyfills/abortSignalAny.ts` after proving no imports remain

- [ ] **Step 1: Write red deterministic-fallback tests**

Assert `selectVersesForIntent` returns only checked-in fallback verses for the requested category and requested count, `generateReflectionPrompts` returns the three existing safe generic prompts with `aiGenerated: false`, `suggestIntents` returns an empty list, `isAiAvailable` returns false, and no function calls a network/model/cache dependency.

- [ ] **Step 2: Preserve the public API with local deterministic behavior**

Keep the exported function signatures so the session UI remains stable. Remove `firebase/ai`, model initialization, generated prompts, history-based personalization, model caches, and generic religious prompt strings. Select from the existing reviewed fallback verse sets deterministically instead of randomly; retain the existing default personal/gratitude/action reflection prompts.

- [ ] **Step 3: Remove the now-unused AI polyfill**

Run `rg -n "abortSignalAny|firebase/ai" app src`. If no runtime import remains after Noor, tafsir, and Tadabbur migration, delete `src/core/polyfills/abortSignalAny.ts`.

- [ ] **Step 4: Verify and commit**

```bash
npm test -- src/features/tadabbur/domain/TadabburAIService.test.ts --runInBand
npm run typecheck
rg -n "firebase/ai|getGenerativeModel|VertexAIBackend|GoogleAIBackend" app src
git add src/features/tadabbur src/core/polyfills
git commit -m "refactor(tadabbur): use deterministic local guidance"
```

Expected search: no client-side model SDK path. This enforces the approved exclusion of direct Gemini calls and new personalization without removing the Tadabbur session itself.

### Task 6: Support Monthly, Annual, and Lifetime selection/purchase

**Files:**
- Modify: `src/features/payments/infrastructure/RevenueCatService.ts`
- Modify: `src/features/auth/infrastructure/ProContext.tsx`
- Modify: `src/features/payments/presentation/paywallOfferUtils.ts`
- Test: `src/features/payments/presentation/paywallOfferUtils.test.ts`
- Modify: `src/features/payments/presentation/PaywallScreen.tsx`
- Modify: `src/features/payments/presentation/RamadanPaywallScreen.tsx`
- Modify: `app/onboarding/premium.tsx`
- Test: `src/features/payments/infrastructure/RevenueCatService.test.ts`
- Test: `src/features/auth/infrastructure/ProContext.test.tsx`
- Test: `src/features/payments/presentation/PaywallScreen.test.tsx`
- Test: `src/features/payments/presentation/RamadanPaywallScreen.test.tsx`
- Test: `src/__tests__/integration/PaywallCheck.test.tsx`
- Test: `src/__tests__/integration/AppFlow.test.tsx`

- [ ] **Step 1: Write red three-plan utility tests**

Define:

```ts
export type BillingPeriod = 'monthly' | 'annual' | 'lifetime';
```

Assert `getSelectedPackage(offering, 'lifetime')` returns `offering.lifetime`, Lifetime has no trial badge or recurring unit, and missing package returns null without substituting another plan.

- [ ] **Step 2: Replace the binary toggle with a three-option selector**

`PaywallScreen`, `RamadanPaywallScreen`, and onboarding premium render only packages present in `offering.current`, default to Annual when present, otherwise Monthly, otherwise Lifetime. Each option shows RevenueCat's localized `priceString`. Lifetime is labeled `Lifetime` and `One-time purchase`; it never says `/year`, trial, renewal, or subscription. Missing-package tests prove no silent plan substitution.

- [ ] **Step 3: Make RevenueCat identity explicit and fail closed**

Add `ensureUserIdentity(firebaseUid): Promise<CustomerInfo>` that calls `Purchases.logIn(firebaseUid)` when needed, verifies `await Purchases.getAppUserID()` equals the Firebase UID, and throws a sanitized identity error on login/mismatch. `logoutUser()` clears identity readiness. Change `checkStatus()` in `ProContext` to return `Promise<boolean>` and expose `identityReady`; auth changes set Pro false until identity binding and authoritative CustomerInfo refresh both succeed. Remove the hardcoded App Review email Pro bypass; App Review access must use a genuine StoreKit purchase/test transaction reflected as active RevenueCat `pro_access`. The server-only `noorOwnerQa/{uid}` class is exclusively for dark backend quota/testing and never unlocks the client hard paywall. Tests cover initial login, account switch, logout, login failure, mismatch, no entitlement leakage from a prior/anonymous user, and owner-QA-without-`pro_access` remaining locked in the client.

- [ ] **Step 4: Reuse purchase and restore only after identity readiness**

Before purchase or restore, require an authenticated Firebase user and `ensureUserIdentity(user.id)`. Call `revenueCatService.purchasePackage(selectedPackage)` for all three package types only after identity readiness. After success, `await checkStatus()` must return true for active `pro_access` before navigating through the hard paywall. Cancellation stays silent; provider errors stay sanitized. Tests cover all three purchases, restore, login failure, and account switching under the Firebase UID.

- [ ] **Step 5: Remove uncapped AI claims**

Replace `Unlimited AI Quran Insights`, `Unlock Unlimited AI Insights`, and related AI-specific unlimited strings with `Noor AI & Quran Explanations`. Add visible copy: `Includes up to 50 successful AI answers per UTC day. Your allowance resets daily.` Do not change legitimate unlimited Notes/Recordings/Folders claims.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- src/features/payments/infrastructure/RevenueCatService.test.ts src/features/auth/infrastructure/ProContext.test.tsx src/features/payments/presentation/paywallOfferUtils.test.ts src/features/payments/presentation/PaywallScreen.test.tsx src/features/payments/presentation/RamadanPaywallScreen.test.tsx src/__tests__/integration/PaywallCheck.test.tsx src/__tests__/integration/AppFlow.test.tsx --runInBand
npm run typecheck
rg -n "Unlimited AI|Unlock Unlimited AI|unlimited AI-powered" app src --glob '!**/data/**'
git add app/onboarding/premium.tsx src/features/payments src/features/auth/infrastructure/ProContext.tsx src/features/auth/infrastructure/ProContext.test.tsx src/__tests__/integration
git commit -m "feat(payments): offer Lifetime alongside subscriptions"
```

Expected search: no purchase-facing uncapped AI claim.

### Task 7: Add Lifetime and AI processing terms

**Files:**
- Modify: `legal/terms.html`
- Modify: `legal/privacy.html`
- Create: `docs/releases/noor-rag-app-store-notes.md`
- Test: `scripts/validate-legal-release-copy.js`
- Modify: `package.json`

- [ ] **Step 1: Add a failing legal-copy validator**

The validator must require: Lifetime described as a non-consumable one-time purchase; Monthly/Annual renewal language; `pro_access` not exposed as user copy; 50 successful AI answers per UTC day and reset behavior; grounded-source limitation; no fatwa/hadith-authentication promise; Firebase/Vertex/RevenueCat processing; 30-day safety telemetry; explicit statement that raw questions/answers are not logged in operational telemetry.

- [ ] **Step 2: Update Terms and Privacy in plain language**

Clarify that generated explanations are educational and source-grounded, can be unavailable when evidence/safety checks fail, and are not religious rulings. Preserve Apple-required subscription terms and add the distinct Lifetime product terms. Use the real legal contact/URLs already present; do not invent new company identities.

- [ ] **Step 3: Add App Store review notes**

Describe how reviewers reach Noor, verse explanations, Lifetime, restore, source citations, and the 50/day policy. State that Lifetime is attached to this app version and grants the same `pro_access` as subscriptions.

- [ ] **Step 4: Verify and commit**

```bash
node scripts/validate-legal-release-copy.js
git diff --check
git add legal docs/releases scripts/validate-legal-release-copy.js package.json
git commit -m "docs(release): disclose Lifetime and governed AI"
```

### Task 8: Port friendly sign-up errors without policy drift

**Files:**
- Create: `src/features/auth/presentation/authErrorMessage.ts`
- Create: `src/features/auth/presentation/authErrorMessage.test.ts`
- Modify: `app/(auth)/sign-up.tsx`
- Create: `src/features/auth/presentation/SignUpScreen.test.tsx`

- [ ] **Step 1: Write red helper tests for the existing six-character policy**

Map `email-already-in-use`, `invalid-email`, `weak-password`, `password-does-not-meet-requirements`, `network-request-failed`, and `too-many-requests`. Unknown/non-error values use the supplied safe fallback. `getSignUpPasswordError` rejects fewer than six characters and accepts `qwerty`; it does not add uppercase or other rules unless a separately recorded Firebase policy verification proves them.

- [ ] **Step 2: Implement the helper**

Use `unknown`, inspect only a string `code`, and never display provider `message`. Copy stays friendly and contains no `Firebase`, `auth/`, internal code, or configuration detail.

- [ ] **Step 3: Write red screen tests**

Prove invalid password does not call `registerWithEmail`, known errors render approved copy, unknown raw provider messages never render, and editing email/password/confirmation clears stale errors.

- [ ] **Step 4: Apply only the approved screen hunks**

Add the helper import, password helper call, `catch (error: unknown)` safe translation, and three `onChangeText` wrappers that clear the stale error. Do not add Google/Apple buttons, handlers, imports, colors, or styles from the dirty checkout.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- src/features/auth/presentation/authErrorMessage.test.ts src/features/auth/presentation/SignUpScreen.test.tsx --runInBand
npm run typecheck
npx eslint app/'(auth)'/sign-up.tsx src/features/auth/presentation/authErrorMessage.ts src/features/auth/presentation/authErrorMessage.test.ts src/features/auth/presentation/SignUpScreen.test.tsx
git add app/'(auth)'/sign-up.tsx src/features/auth/presentation
git commit -m "fix(auth): show safe sign-up guidance"
```

### Task 9: Run the client security and regression gate

**Files:**
- Modify only if a failing test exposes a scoped defect.

- [ ] **Step 1: Prove no client model/key fallback remains**

```bash
rg -n "EXPO_PUBLIC_GEMINI_API_KEY|GoogleGenerativeAI|generativelanguage.googleapis.com|firebase/ai|getGenerativeModel|VertexAIBackend|GoogleAIBackend|generateWithFallback" app src package.json --glob '*.{ts,tsx,js,jsx,json}' --glob '!**/*.test.*' --glob '!**/docs/**'
node -e "const p=require('./package.json'); if (p.dependencies?.['@google/generative-ai'] || p.devDependencies?.['@google/generative-ai']) process.exit(1)"
if npm ls @google/generative-ai --depth=0 >/dev/null 2>&1; then echo "forbidden direct dependency: @google/generative-ai"; exit 1; fi
rg -n "NoorUsageService|TafsirUsageService" app src --glob '!**/*.test.*' --glob '!**/data/**'
rg -n "Unlimited AI|Unlock Unlimited AI|unlimited AI-powered" app src --glob '!**/data/**'
```

Expected: the runtime/static search is empty, both direct-dependency assertions pass because `@google/generative-ai` is absent at depth zero, and neither legacy quota service has a runtime import. Transitive `@firebase/ai` inside the retained Firebase umbrella package is not a shipped import by QuranNotes and is not treated as a direct dependency.

- [ ] **Step 2: Run focused and full verification**

```bash
npm run typecheck
npm test -- --runInBand --passWithNoTests
npm run lint
npx expo export --platform ios
node scripts/generate-noor-contract.js --check
git diff --check
```

If the known Firebase Functions/Jest transform issue remains, diagnose and correct the harness without excluding the affected paywall coverage or weakening transforms.

- [ ] **Step 3: Commit the verified checkpoint**

```bash
git status --short
git add -A
git commit -m "test(release): verify Noor client and commercial flows"
```

Only commit if the staged set is exactly the approved client plan scope and the worktree was clean before the task.

### Task 10: Remove the legacy verse callable after its client caller is gone

**Files:**
- Modify: `functions/src/index.ts`
- Test: `functions/test/noor-rag/legacy-cleanup.test.ts`

- [ ] **Step 1: Write a red legacy-export audit**

Assert the compiled Functions exports include `askNoorRagV1` and `onUserDeleted` but not `explainVerse` or `askSheikh`. Assert repository runtime search finds no `GeminiAPI` or `VerseTafseerModal` import.

- [ ] **Step 2: Remove only the dead `explainVerse` block**

Preserve the reviewed `onUserDeleted` and new Noor cleanup. Remove the OpenAI proxy, prompt, environment/config key lookup, and export. Do not alter unrelated deletion behavior except the already reviewed Noor cleanup.

- [ ] **Step 3: Verify and commit**

```bash
npm --prefix functions run build:test
node --test functions/lib-test/test/noor-rag/legacy-cleanup.test.js
npm --prefix functions run build
rg -n "explainVerse|askSheikh|GeminiAPI|VerseTafseerModal|OPENAI_API_KEY" app src functions/src
git add functions/src/index.ts functions/test/noor-rag/legacy-cleanup.test.ts
git commit -m "refactor(ai): remove retired verse proxy"
```

Expected search: no match in shipped client/Functions runtime.

## Client completion gate

Record test totals, typecheck/lint/export results, static-audit output, three-plan UI evidence including Ramadan paywall, RevenueCat UID-binding tests, sign-up screen evidence, backend/client contract drift result, reviewed SHA, and independent specification/code-quality/security verdicts. Native prebuild, App Check console registration, dashboard changes, StoreKit proof, archive, and upload remain unexecuted.
