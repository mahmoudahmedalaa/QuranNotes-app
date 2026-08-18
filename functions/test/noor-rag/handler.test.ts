import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NoorEntitlementUnavailableError } from '../../src/noor-rag/entitlement';
import { generateGroundedAnswer, type GenerationProvider } from '../../src/noor-rag/generation';
import {
    handleNoorRequest,
    type NoorHandlerDependencies,
    type NoorHandlerTelemetryEvent,
    type NoorSanitizedTrace,
} from '../../src/noor-rag/handler';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import type { ClaimResult } from '../../src/noor-rag/usage';
import type { NoorAnswer, NoorRequest, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

const UID = 'sensitive-user@example.com';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';
const INVOCATION_ID = 'invocation-1';
const REQUEST: NoorRequest = {
    mode: 'chat', requestId: REQUEST_ID, question: 'What is patience?',
    history: [{ role: 'user', content: 'sensitive history' }],
};
const CONFIG: NoorRuntimeConfig = {
    enabled: true, publicEnabled: true, ownerUids: [], activeCorpusVersion: 'corpus-v1',
    promptVersion: 'prompt-v1', generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
    pseudonymKeyVersion: 'key-v1',
    sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
    maxChunksPerSource: 4, maxEvidenceCharacters: 5000,
};

function chunk(id = 'chunk-1', text = 'patience is described in this tafsir passage'): TafsirChunk {
    return {
        chunkId: id, canonicalUnitId: 'unit-1', chunkIndex: 0,
        source: 'ibn_kathir_en_abridged', sourceTitle: 'Tafsir Ibn Kathir', language: 'en',
        surah: 2, verseStart: 153, verseEnd: 153, originalStart: 0, originalEnd: 6,
        originalText: text, retrievalText: text, corpusVersion: 'corpus-v1',
        contentHash: 'hash', tokenCount: 1, embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
    };
}

const EVIDENCE: RetrievedEvidence[] = [{ kind: 'semantic', promptSourceId: 'S1', chunk: chunk(), similarity: 0.9 }];
const ANSWERED: NoorAnswer = {
    requestId: REQUEST_ID, status: 'answered', answer: 'Grounded answer. [S1]',
    citations: [{
        chunkId: 'chunk-1', canonicalUnitId: 'unit-1', source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir', surah: 2, verseStart: 153, verseEnd: 153,
        corpusVersion: 'corpus-v1',
    }],
};

interface Harness {
    events: string[];
    telemetry: NoorHandlerTelemetryEvent[];
    dependencies: NoorHandlerDependencies;
}

function harness(overrides: Partial<NoorHandlerDependencies> = {}): Harness {
    const events: string[] = [];
    const telemetry: NoorHandlerTelemetryEvent[] = [];
    const dependencies: NoorHandlerDependencies = {
        loadRuntimeConfig: async () => { events.push('config'); return CONFIG; },
        verifyCorpusReady: async () => { events.push('corpus'); return true; },
        readCompletedReplay: async () => { events.push('pre-replay'); return null; },
        resolveEntitlement: async () => { events.push('entitlement'); return { class: 'paid', expiresAt: null, source: 'revenuecat' }; },
        claimUsage: async () => { events.push('claim'); return { kind: 'claimed', leaseOwnerId: INVOCATION_ID, leaseExpiresAt: '2026-08-11T12:02:00.000Z' }; },
        classifyPolicy: () => { events.push('policy'); return 'allowed'; },
        retrieveSemantic: async () => { events.push('semantic'); return EVIDENCE; },
        retrieveExact: async () => { events.push('exact'); return EVIDENCE; },
        generateGroundedAnswer: async () => { events.push('model'); return ANSWERED; },
        finalizeAnswered: async () => { events.push('finalize-answered'); return { kind: 'finalized' }; },
        finalizeNonAnswer: async () => { events.push('finalize-non-answer'); return { kind: 'finalized' }; },
        emitTelemetry: async event => { events.push('telemetry'); telemetry.push(event); },
        nowMs: () => 100,
        ...overrides,
    };
    return { events, telemetry, dependencies };
}

async function run(value: Harness, request: NoorRequest = REQUEST): Promise<NoorAnswer> {
    return handleNoorRequest({ request, uid: UID, invocationId: INVOCATION_ID, dependencies: value.dependencies });
}

describe('handleNoorRequest', () => {
    it('fails calmly for missing, malformed, disabled, dark-gated, and inactive corpus configuration', async () => {
        for (const loadRuntimeConfig of [
            async (): Promise<NoorRuntimeConfig> => { throw new Error('missing secret config body'); },
            async (): Promise<NoorRuntimeConfig> => ({ ...CONFIG, enabled: false }),
            async (): Promise<NoorRuntimeConfig> => ({ ...CONFIG, publicEnabled: false, ownerUids: [] }),
            async (): Promise<NoorRuntimeConfig> => ({ ...CONFIG, activeCorpusVersion: 'none' }),
        ]) {
            const value = harness({ loadRuntimeConfig });
            assert.equal((await run(value)).status, 'temporarily_unavailable');
            assert.ok(!value.events.includes('entitlement'));
        }
        const owner = harness({ loadRuntimeConfig: async () => ({ ...CONFIG, publicEnabled: false, ownerUids: [UID] }) });
        assert.equal((await run(owner)).status, 'answered');
        const publicGate = harness({ loadRuntimeConfig: async () => ({ ...CONFIG, publicEnabled: true, ownerUids: [] }) });
        assert.equal((await run(publicGate)).status, 'answered');
        const corpus = harness({ verifyCorpusReady: async () => false });
        assert.equal((await run(corpus)).status, 'temporarily_unavailable');
        assert.ok(!corpus.events.includes('entitlement'));
    });

    it('returns a valid pre-entitlement replay even when entitlement would fail', async () => {
        const value = harness({
            readCompletedReplay: async () => { value.events.push('pre-replay'); return ANSWERED; },
            resolveEntitlement: async () => { throw new NoorEntitlementUnavailableError(); },
        });
        assert.deepEqual(await run(value), ANSWERED);
        assert.deepEqual(value.events.slice(0, 3), ['config', 'corpus', 'pre-replay']);
        assert.ok(!value.events.includes('entitlement'));
    });

    it('maps inactive entitlement, entitlement outage, quota, rate limit, and contention', async () => {
        const none = harness({ resolveEntitlement: async () => ({ class: 'none', expiresAt: null, source: 'revenuecat' }) });
        assert.equal((await run(none)).status, 'not_entitled');
        assert.ok(!none.events.includes('claim'));
        const outage = harness({ resolveEntitlement: async () => { throw new NoorEntitlementUnavailableError(); } });
        assert.equal((await run(outage)).status, 'temporarily_unavailable');
        for (const claim of [
            { kind: 'rate_limited', retryAt: '2026-08-11T12:01:00.000Z' },
            { kind: 'in_progress', retryAt: '2026-08-11T12:02:00.000Z' },
        ] satisfies ClaimResult[]) {
            const value = harness({ claimUsage: async () => claim });
            assert.equal((await run(value)).status, 'temporarily_unavailable');
            assert.ok(!value.events.includes('policy'));
        }
        const quota = harness({ claimUsage: async () => ({ kind: 'quota_exceeded', nextResetAt: '2026-08-12T00:00:00.000Z' }) });
        const response = await run(quota);
        assert.equal(response.status, 'quota_exceeded');
        assert.equal(response.nextResetAt, '2026-08-12T00:00:00.000Z');
    });

    it('runs policy after claim and releases refusal without retrieval or generation', async () => {
        const value = harness({ classifyPolicy: () => { value.events.push('policy'); return 'personal_ruling'; } });
        assert.equal((await run(value)).status, 'policy_refusal');
        assert.deepEqual(value.events.slice(0, 7), ['config', 'corpus', 'pre-replay', 'entitlement', 'claim', 'policy', 'finalize-non-answer']);
        assert.ok(!value.events.includes('semantic'));
        assert.ok(!value.events.includes('model'));
    });

    it('uses semantic retrieval once for chat and exact retrieval once for both verse modes', async () => {
        const chat = harness();
        assert.equal((await run(chat)).status, 'answered');
        assert.equal(chat.events.filter(value => value === 'semantic').length, 1);
        assert.equal(chat.events.filter(value => value === 'model').length, 1);
        assert.ok(chat.events.indexOf('finalize-answered') < chat.events.indexOf('telemetry'));
        for (const request of [
            { mode: 'verse_summary', requestId: REQUEST_ID, source: 'al_sadi_ar', surah: 2, verse: 255 },
            { mode: 'verse_question', requestId: REQUEST_ID, source: 'ibn_kathir_en_abridged', surah: 2, verse: 255, question: 'Explain' },
        ] satisfies NoorRequest[]) {
            const value = harness();
            assert.equal((await run(value, request)).status, 'answered');
            assert.equal(value.events.filter(event => event === 'exact').length, 1);
            assert.equal(value.events.filter(event => event === 'semantic').length, 0);
            assert.equal(value.events.filter(event => event === 'model').length, 1);
        }
    });

    it('keeps a later fitting candidate when an earlier source candidate exceeds the merge budget', async () => {
        const oversized = {
            ...EVIDENCE[0]!,
            promptSourceId: 'S1',
            chunk: {
                ...chunk('a-oversized'),
                canonicalUnitId: 'oversized-unit',
                originalText: '123456789',
                retrievalText: '123456789',
            },
        } satisfies RetrievedEvidence;
        const fitting = {
            ...EVIDENCE[0]!,
            promptSourceId: 'S2',
            chunk: {
                ...chunk('z-fitting'),
                canonicalUnitId: 'fitting-unit',
                originalText: 'patience',
                retrievalText: 'patience',
            },
        } satisfies RetrievedEvidence;
        let generatedEvidence: readonly RetrievedEvidence[] = [];
        const value = harness({
            loadRuntimeConfig: async () => ({ ...CONFIG, maxEvidenceCharacters: 8 }),
            retrieveSemantic: async () => ({
                evidence: [oversized, fitting],
                vectorHitCount: 2,
                lexicalHitCount: 0,
                lexicalSearchStatus: 'not_configured' as const,
            }),
            generateGroundedAnswer: async input => {
                generatedEvidence = input.evidence;
                return ANSWERED;
            },
        });

        assert.equal((await run(value)).status, 'answered');
        assert.deepEqual(generatedEvidence.map(item => item.chunk.chunkId), ['z-fitting']);
    });

    it('clarifies structural follow-ups without validated prior evidence and skips retrieval and generation', async () => {
        const value = harness({
            retrieveSemantic: async () => { value.events.push('unexpected-semantic'); return EVIDENCE; },
            generateGroundedAnswer: async () => { value.events.push('unexpected-model'); return ANSWERED; },
        });
        const response = await run(value, {
            mode: 'chat',
            requestId: '22222222-2222-4222-8222-222222222222',
            question: 'What is the Islamic alternative?',
            history: [{ role: 'user', content: 'Is riba haram?' }],
        });
        assert.equal(response.status, 'insufficient_evidence');
        assert.match(response.answer, /name|context|topic|verse/i);
        assert.ok(!value.events.includes('unexpected-semantic'));
        assert.ok(!value.events.includes('unexpected-model'));
        assert.ok(value.events.includes('finalize-non-answer'));
    });

    it('releases every generated non-answer and handles empty evidence and retrieval exceptions', async () => {
        for (const status of ['policy_refusal', 'insufficient_evidence', 'not_entitled', 'invalid_request', 'temporarily_unavailable'] as const) {
            const value = harness({ generateGroundedAnswer: async () => ({ requestId: REQUEST_ID, status, answer: 'safe', citations: [] }) });
            assert.equal((await run(value)).status, status);
            assert.equal(value.events.filter(event => event === 'finalize-non-answer').length, 1);
        }
        const generatedQuota = harness({ generateGroundedAnswer: async () => ({
            requestId: REQUEST_ID, status: 'quota_exceeded', answer: 'safe', citations: [],
            nextResetAt: '2026-08-12T00:00:00.000Z',
        }) });
        assert.equal((await run(generatedQuota)).status, 'quota_exceeded');
        assert.equal(generatedQuota.events.filter(event => event === 'finalize-non-answer').length, 1);
        const empty = harness({ retrieveSemantic: async () => [] });
        assert.equal((await run(empty)).status, 'insufficient_evidence');
        assert.ok(!empty.events.includes('model'));
        assert.ok(empty.events.includes('finalize-non-answer'));
        const failure = harness({ retrieveSemantic: async () => { throw new Error('vector index provider secret'); } });
        assert.equal((await run(failure)).status, 'temporarily_unavailable');
        assert.ok(!failure.events.includes('model'));
        assert.ok(failure.events.includes('finalize-non-answer'));
    });

    it('performs one bounded recovery retrieval and generates only from relevant evidence', async () => {
        const unrelated = {
            ...EVIDENCE[0]!,
            chunk: chunk('unrelated', 'Al-Qasas contains an unrelated story.'),
        } satisfies RetrievedEvidence;
        const relevant = {
            ...EVIDENCE[0]!,
            chunk: chunk('baqarah-2-1', 'Virtues of Surat Al-Baqarah are discussed in Ibn Kathir.'),
        } satisfies RetrievedEvidence;
        const queries: string[] = [];
        let generatedEvidence: readonly RetrievedEvidence[] = [];
        const value = harness({
            retrieveSemantic: async input => {
                queries.push(input.query);
                return queries.length === 1 ? { evidence: [unrelated], vectorHitCount: 1, lexicalHitCount: 1, lexicalSearchStatus: 'available' } : { evidence: [relevant], vectorHitCount: 1, lexicalHitCount: 1, lexicalSearchStatus: 'available' };
            },
            generateGroundedAnswer: async input => {
                generatedEvidence = input.evidence;
                const item = input.evidence[0]!;
                return {
                    requestId: input.request.requestId,
                    status: 'answered',
                    answer: 'Grounded Al-Baqarah answer. [S1]',
                    citations: [{
                        chunkId: item.chunk.chunkId,
                        canonicalUnitId: item.chunk.canonicalUnitId,
                        source: item.chunk.source,
                        sourceTitle: item.chunk.sourceTitle,
                        surah: item.chunk.surah,
                        verseStart: item.chunk.verseStart,
                        verseEnd: item.chunk.verseEnd,
                        corpusVersion: item.chunk.corpusVersion,
                    }],
                };
            },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'What is the significance of Surah Al-Baqarah?',
            history: [],
        });

        assert.equal(response.status, 'answered');
        assert.equal(queries.length, 2);
        assert.match(queries[1]!, /Quran tafsir/i);
        assert.deepEqual(generatedEvidence.map(item => item.chunk.chunkId), ['baqarah-2-1']);
    });

    it('abstains after one weak-evidence recovery and never surfaces unrelated citations', async () => {
        const unrelated = {
            ...EVIDENCE[0]!,
            chunk: chunk('unrelated', 'Al-Qasas contains an unrelated story.'),
        } satisfies RetrievedEvidence;
        const queries: string[] = [];
        let modelCalled = false;
        const value = harness({
            retrieveSemantic: async input => {
                queries.push(input.query);
                return { evidence: [unrelated], vectorHitCount: 1, lexicalHitCount: 1, lexicalSearchStatus: 'available' };
            },
            generateGroundedAnswer: async () => { modelCalled = true; return ANSWERED; },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'What is the significance of Surah Al-Baqarah?',
            history: [],
        });

        assert.equal(response.status, 'insufficient_evidence');
        assert.equal(queries.length, 2);
        assert.equal(modelCalled, false);
        assert.deepEqual(response.citations, []);
    });

    it('maps provider timeout, hides finalization failures, and rejects mismatched response IDs', async () => {
        const timeout = harness({ generateGroundedAnswer: async () => ({ requestId: REQUEST_ID, status: 'temporarily_unavailable', answer: 'safe', citations: [] }) });
        assert.equal((await run(timeout)).status, 'temporarily_unavailable');
        assert.ok(timeout.events.includes('finalize-non-answer'));
        const finalizeFailure = harness({ finalizeAnswered: async () => { throw new Error('database body'); } });
        const hidden = await run(finalizeFailure);
        assert.equal(hidden.status, 'temporarily_unavailable');
        assert.doesNotMatch(hidden.answer, /Grounded|database/i);
        assert.ok(finalizeFailure.events.includes('finalize-non-answer'));
        const mismatch = harness({ generateGroundedAnswer: async () => ({ ...ANSWERED, requestId: '22222222-2222-4222-8222-222222222222' }) });
        assert.equal((await run(mismatch)).status, 'temporarily_unavailable');
        assert.ok(mismatch.events.includes('finalize-non-answer'));
    });

    it('rejects answered responses without citations and records citation failures', async () => {
        const traces: NoorSanitizedTrace[] = [];
        const noCitations = harness({
            generateGroundedAnswer: async () => ({ requestId: REQUEST_ID, status: 'answered', answer: 'Uncited answer', citations: [] }),
            emitSanitizedTrace: trace => { traces.push(trace); },
        });
        const response = await run(noCitations);
        assert.equal(response.status, 'temporarily_unavailable');
        assert.equal(noCitations.telemetry[0]?.errorClass, 'citation_validation_failure');

        const replay = harness({
            claimUsage: async () => ({
                kind: 'replay',
                response: { requestId: REQUEST_ID, status: 'answered', answer: 'Uncited replay', citations: [] },
            }),
        });
        assert.equal((await run(replay)).status, 'temporarily_unavailable');
        assert.ok(!replay.events.includes('policy'));

        const provider = (results: Array<string | Error>): GenerationProvider => ({
            generate: async () => {
                const result = results.shift();
                if (result instanceof Error) throw result;
                if (result === undefined) throw new Error('fixture exhausted');
                return result;
            },
        });
        const generated = await generateGroundedAnswer({
            request: REQUEST,
            evidence: EVIDENCE,
            maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
            provider: provider(['{"answer":"Grounded. [S9]","citationIds":["S9"]}', '{"answer":"Grounded. [S9]","citationIds":["S9"]}']),
        });
        const citationFailure = harness({ generateGroundedAnswer: async () => generated, emitSanitizedTrace: trace => { traces.push(trace); } });
        assert.equal((await run(citationFailure)).status, 'temporarily_unavailable');
        assert.equal(traces.at(-1)?.citationValidation, 'failed');
    });

    it('returns claim replay without policy/retrieval/model and fails closed on replay ID mismatch', async () => {
        const replay = harness({ claimUsage: async () => ({ kind: 'replay', response: ANSWERED }) });
        assert.deepEqual(await run(replay), ANSWERED);
        assert.ok(!replay.events.includes('policy'));
        const mismatch = harness({ claimUsage: async () => ({ kind: 'replay', response: { ...ANSWERED, requestId: '22222222-2222-4222-8222-222222222222' } }) });
        assert.equal((await run(mismatch)).status, 'temporarily_unavailable');
        assert.ok(!mismatch.events.includes('policy'));
    });

    it('emits only bounded metadata, omits sensitive values, and ignores telemetry failures', async () => {
        let tick = 100;
        const value = harness({ nowMs: () => tick += 17 });
        assert.equal((await run(value)).status, 'answered');
        assert.equal(value.telemetry.length, 1);
        assert.deepEqual(Object.keys(value.telemetry[0]!).sort(), [
            'citationCount', 'corpusVersion', 'durationMs', 'entitlementClass', 'errorClass',
            'generationModel', 'generationMs', 'mode', 'outcome', 'promptVersion', 'requestId', 'retrievalMs', 'retrievedChunkIds',
        ]);
        const serialized = JSON.stringify(value.telemetry[0]);
        assert.doesNotMatch(serialized, /sensitive|example\.com|Grounded answer|source|provider/i);
        assert.deepEqual(value.telemetry[0]?.retrievedChunkIds, ['chunk-1']);
        assert.equal(Number.isInteger(value.telemetry[0]?.durationMs), true);
        assert.equal(Number.isInteger(value.telemetry[0]?.retrievalMs), true);
        assert.equal(Number.isInteger(value.telemetry[0]?.generationMs), true);
        const telemetryFailure = harness({ emitTelemetry: async () => { throw new Error('telemetry down'); } });
        assert.equal((await run(telemetryFailure)).status, 'answered');
    });

    it('records bounded generation error classes while preserving safe public statuses', async () => {
        const provider = (results: Array<string | Error>): GenerationProvider => ({
            generate: async () => {
                const result = results.shift();
                if (result instanceof Error) throw result;
                if (result === undefined) throw new Error('fixture exhausted');
                return result;
            },
        });
        const cases = [
            { results: ['not-json', 'still-not-json'], status: 'temporarily_unavailable', errorClass: 'malformed_json' },
            { results: ['{"answer":"Grounded. [S9]","citationIds":["S9"]}', '{"answer":"Grounded. [S9]","citationIds":["S9"]}'], status: 'temporarily_unavailable', errorClass: 'citation_validation_failure' },
            { results: ['{"answer":"Uncited answer","citationIds":[]}', '{"answer":"Uncited answer","citationIds":[]}'], status: 'temporarily_unavailable', errorClass: 'answer_validation_failure' },
            { results: [Object.assign(new Error('DEADLINE_EXCEEDED provider-secret'), { code: 'DEADLINE_EXCEEDED' })], status: 'temporarily_unavailable', errorClass: 'provider_timeout' },
            { results: [Object.assign(new Error('temporary upstream failure'), { status: 503 }), '{"answer":"Grounded answer. [S1]","citationIds":["S1"]}'], status: 'answered', errorClass: null },
        ] as const;
        for (const value of cases) {
            const generated = await generateGroundedAnswer({
                request: REQUEST, evidence: EVIDENCE, maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
                provider: provider([...value.results]),
            });
            const harnessValue = harness({ generateGroundedAnswer: async () => generated });
            const response = await run(harnessValue);
            assert.equal(response.status, value.status);
            assert.equal(harnessValue.telemetry[0]?.errorClass, value.errorClass);
        }
    });
});
