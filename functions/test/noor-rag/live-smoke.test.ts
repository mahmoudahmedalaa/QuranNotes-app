import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    buildCallableRequest,
    parseCallableResponse,
    parseLiveSmokeOptions,
    redactLiveSmokeResult,
    type LiveSmokeCredentials,
    type LiveSmokeObservation,
} from '../../scripts/noor-rag/live-smoke';

const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const CREDENTIALS: LiveSmokeCredentials = {
    endpoint: 'https://example.test/askNoorRagV1',
    firebaseIdToken: 'firebase-token-secret',
    appCheckToken: 'app-check-token-secret',
};

function answeredBody(): Record<string, unknown> {
    return {
        result: {
            requestId: REQUEST_ID,
            answer: 'Provider answer that must never appear in smoke output.',
            status: 'answered',
            citations: [{
                chunkId: 'private-chunk-id',
                canonicalUnitId: 'private-unit-id',
                source: 'al_sadi_ar',
                sourceTitle: "Tafsir Al-Sa'di",
                surah: 2,
                verseStart: 153,
                verseEnd: 153,
                corpusVersion: 'private-corpus-version',
            }],
        },
    };
}

describe('Noor live smoke helpers', () => {
    it('builds the Firebase callable envelope and authentication headers', () => {
        const request = {
            mode: 'chat' as const,
            requestId: REQUEST_ID,
            question: 'Explain patience using tafsir evidence.',
            history: [],
        };
        const built = buildCallableRequest(request, CREDENTIALS);

        assert.equal(built.url, CREDENTIALS.endpoint);
        assert.equal(built.init.method, 'POST');
        assert.equal(built.init.headers?.Authorization, `Bearer ${CREDENTIALS.firebaseIdToken}`);
        assert.equal(built.init.headers?.['X-Firebase-AppCheck'], CREDENTIALS.appCheckToken);
        assert.equal(built.init.headers?.['Content-Type'], 'application/json');
        assert.deepEqual(JSON.parse(built.init.body as string), { data: request });
    });

    it('redacts answers, identifiers, credentials, and provider details from output', () => {
        const observation: LiveSmokeObservation = {
            status: 'answered',
            citations: [{ source: 'al_sadi_ar', surah: 2, verseStart: 153, verseEnd: 153 }],
            errorClass: null,
        };
        const result = redactLiveSmokeResult('chat', 42, observation);
        const serialized = JSON.stringify(result);

        assert.deepEqual(result, {
            case: 'chat',
            status: 'answered',
            citationCount: 1,
            citations: [{ source: 'al_sadi_ar', verse: '2:153-153' }],
            latencyMs: 42,
            errorClass: null,
        });
        for (const forbidden of [
            'Provider answer', 'firebase-token-secret', 'app-check-token-secret',
            'private-chunk-id', 'private-unit-id', 'private-corpus-version',
            'uid', 'provider details',
        ]) {
            assert.equal(serialized.includes(forbidden), false);
        }
    });

    it('refuses a quota count above the daily limit without explicit live-quota approval', () => {
        assert.throws(
            () => parseLiveSmokeOptions(['--mode=quota', '--count=51', '--interval-ms=12000']),
            /allow-live-quota/i,
        );
        const approved = parseLiveSmokeOptions([
            '--mode=quota', '--count=51', '--interval-ms=12000', '--allow-live-quota',
        ]);
        assert.equal(approved.count, 51);
        assert.equal(approved.allowLiveQuota, true);
    });

    it('defaults to one non-quota chat request and a conservative quota interval', () => {
        const defaults = parseLiveSmokeOptions([]);
        assert.equal(defaults.mode, 'chat');
        assert.equal(defaults.count, 1);
        assert.equal(defaults.intervalMs, 12_000);
        const quota = parseLiveSmokeOptions(['--mode=quota']);
        assert.equal(quota.count, 1);
        assert.equal(quota.intervalMs, 12_000);
    });

    it('parses backend statuses and maps transport failures to safe error classes', () => {
        const answered = parseCallableResponse(200, answeredBody(), REQUEST_ID);
        assert.equal(answered.status, 'answered');
        assert.equal(answered.citations[0]?.source, 'al_sadi_ar');
        assert.equal(answered.citations[0]?.surah, 2);
        assert.equal(answered.citations[0]?.verseStart, 153);

        const rateLimited = parseCallableResponse(429, {
            error: { status: 'RESOURCE_EXHAUSTED', message: 'raw provider details must be ignored' },
        }, REQUEST_ID);
        assert.equal(rateLimited.status, 'transport_error');
        assert.equal(rateLimited.errorClass, 'rate_limited');
        assert.equal(rateLimited.answerForHistory, undefined);

        const malformed = parseCallableResponse(200, { result: { answer: 'not a valid answer' } }, REQUEST_ID);
        assert.equal(malformed.status, 'malformed_response');
        assert.equal(malformed.errorClass, 'malformed_response');
    });
});
