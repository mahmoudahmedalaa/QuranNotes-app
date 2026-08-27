import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    boundNoorHistory,
    buildCallableRequest,
    MAX_NOOR_HISTORY_TURNS,
    parseCallableErrorDiagnostics,
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
    it('bounds eight and ten accumulated entries to the latest six in chronological order', () => {
        assert.equal(MAX_NOOR_HISTORY_TURNS, 6);
        for (const accumulatedCount of [8, 10]) {
            const history = Array.from({ length: accumulatedCount }, (_, index) => ({
                role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
                content: `${index}`,
            }));
            const bounded = boundNoorHistory(history);

            assert.deepEqual(bounded, history.slice(-6));
            assert.deepEqual(bounded.map(turn => turn.content), [`${accumulatedCount - 6}`, `${accumulatedCount - 5}`, `${accumulatedCount - 4}`, `${accumulatedCount - 3}`, `${accumulatedCount - 2}`, `${accumulatedCount - 1}`]);
            assert.deepEqual(bounded.map(turn => turn.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant']);
        }
    });

    it('bounds chat history at the callable envelope boundary', () => {
        const history = Array.from({ length: 8 }, (_, index) => ({
            role: index % 2 === 0 ? 'user' as const : 'assistant' as const,
            content: `${index}`,
        }));
        const request = {
            mode: 'chat' as const,
            requestId: REQUEST_ID,
            question: 'Current question',
            history,
        };
        const built = buildCallableRequest(request, CREDENTIALS);
        const outgoing = JSON.parse(built.init.body).data;
        assert.deepEqual(outgoing.history, history.slice(-6));
    });

    it('keeps the verifier bound in parity with the Noor request parser', async () => {
        const { parseNoorRequest } = await import('../../src/noor-rag/validation');
        const entry = { role: 'user' as const, content: 'Prior turn' };
        for (const count of [0, 2, 4, 6]) {
            const valid = {
                mode: 'chat' as const,
                requestId: REQUEST_ID,
                question: 'Current question',
                history: Array.from({ length: count }, () => entry),
            };
            assert.doesNotThrow(() => parseNoorRequest(valid));
        }
        const valid = {
            mode: 'chat' as const,
            requestId: REQUEST_ID,
            question: 'Current question',
            history: Array.from({ length: MAX_NOOR_HISTORY_TURNS }, () => ({
                role: 'user' as const,
                content: 'x'.repeat(1_000),
            })),
        };
        assert.doesNotThrow(() => parseNoorRequest(valid));
        assert.equal(valid.history.every(turn => turn.content.length <= 1_000), true);
        assert.throws(
            () => parseNoorRequest({ ...valid, history: [...valid.history, entry] }),
            /Invalid Noor request/,
        );
    });

    it('retains only safe callable error diagnostics', () => {
        const diagnostics = parseCallableErrorDiagnostics(
            400,
            { error: { status: 'INVALID_ARGUMENT', message: 'The Noor request is invalid.' } },
            REQUEST_ID,
            new Map([
                ['x-cloud-trace-context', 'trace-id/123;o=1'],
                ['authorization', 'Bearer secret-token'],
            ]),
        );

        assert.deepEqual(diagnostics, {
            clientRequestId: REQUEST_ID,
            httpStatus: 400,
            callableErrorCode: null,
            callableErrorStatus: 'INVALID_ARGUMENT',
            callableErrorMessage: 'The Noor request is invalid.',
            cloudTrace: 'trace-id/123;o=1',
        });
        assert.equal(JSON.stringify(diagnostics).includes('secret-token'), false);
    });

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
        }, REQUEST_ID, new Map([['x-cloud-trace-id', 'trace-429']]));
        assert.equal(rateLimited.status, 'transport_error');
        assert.equal(rateLimited.errorClass, 'rate_limited');
        assert.equal(rateLimited.answerForHistory, undefined);
        assert.equal(rateLimited.transportDiagnostics?.clientRequestId, REQUEST_ID);
        assert.equal(rateLimited.transportDiagnostics?.callableErrorStatus, 'RESOURCE_EXHAUSTED');
        assert.equal(rateLimited.transportDiagnostics?.callableErrorMessage, 'raw provider details must be ignored');
        assert.equal(rateLimited.transportDiagnostics?.cloudTrace, 'trace-429');

        const malformed = parseCallableResponse(200, { result: { answer: 'not a valid answer' } }, REQUEST_ID);
        assert.equal(malformed.status, 'malformed_response');
        assert.equal(malformed.errorClass, 'malformed_response');
    });
});
