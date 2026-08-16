# Noor live-smoke CLI

`functions/scripts/noor-rag/live-smoke.ts` is a bounded operator harness for the deployed Firebase callable. It is opt-in: importing the module, building it, running its tests, or invoking `--help` never performs network I/O.

## Credentials

Provide the endpoint and both tokens through environment variables:

```bash
NOOR_LIVE_SMOKE_ENDPOINT='https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1' \
NOOR_LIVE_SMOKE_FIREBASE_ID_TOKEN='<firebase-id-token>' \
NOOR_LIVE_SMOKE_APP_CHECK_TOKEN='<app-check-token>' \
npm run noor:live-smoke -- --mode=chat
```

Alternatively, pass one JSON object through stdin with `--credentials-stdin`:

```json
{
  "endpoint": "https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1",
  "firebaseIdToken": "<firebase-id-token>",
  "appCheckToken": "<app-check-token>"
}
```

Tokens are never accepted as command-line arguments and are never included in output. The CLI sends the Firebase callable envelope `{ "data": request }` with `Authorization: Bearer ...` and `X-Firebase-AppCheck` headers.

## Modes

```bash
npm run noor:live-smoke -- --mode=chat
npm run noor:live-smoke -- --mode=conversation
npm run noor:live-smoke -- --mode=verse-parity
npm run noor:live-smoke -- --mode=quota --count=5 --interval-ms=12000
```

- `chat` sends one bounded chat request. This is the default.
- `conversation` sends three sequential chat turns and feeds the returned answer internally into bounded history. Answers are not printed.
- `verse-parity` sends exact `verse_summary` requests for two different verses and marks an answered response as `verse_mismatch` if its citations do not cover the requested verse.
- `quota` sends the requested number of independent chat requests. Its default is one request with a 12-second interval.

Quota mode is a live operation: every real request can consume entitlement and model capacity. The backend limiter allows five attempts per rolling minute, so use `--interval-ms=12000` or greater for a paced run. Counts above the paid daily limit of 50 require `--allow-live-quota`; the CLI remains hard-bounded at 100 requests.

## Output contract

The JSON report contains only the mode, request count, case label, backend-safe status, citation count, citation source/verse references, request latency, and a normalized error class. It excludes prompts, answers, chunk IDs, corpus IDs, provider messages, tokens, Firebase UIDs, and endpoint credentials.

## Verification

Run the network-free tests and script build from `functions/`:

```bash
npm test
npm run build:scripts
```

These checks validate envelope/header construction, redaction, status parsing, count guards, and the no-network import path. They do not claim production behavior without valid Firebase Auth and App Check credentials.
