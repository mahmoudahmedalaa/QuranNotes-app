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
import { createValidatedConversationState } from '../../src/noor-rag/queryRewrite';
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
const QUALITY_PASS = JSON.stringify({
    grounded: true,
    answersQuestion: true,
    preservesMaterialQualifications: true,
    materiallyMisleading: false,
    clear: true,
    citationConsistent: true,
});

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
        retrieveEntitySummary: async () => { events.push('entity-summary'); return { evidence: EVIDENCE, candidateCount: 1, anchorVerses: [153] }; },
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

    it('replays a completed mobile request without duplicate generation, claim, or conversation state', async () => {
        let completed: NoorAnswer | null = null;
        let claimCount = 0;
        let generationCount = 0;
        let finalizeCount = 0;
        let stateWriteCount = 0;
        const value = harness({
            readCompletedReplay: async () => completed,
            claimUsage: async () => {
                claimCount += 1;
                return { kind: 'claimed' as const, leaseOwnerId: INVOCATION_ID, leaseExpiresAt: '2026-08-11T12:02:00.000Z' };
            },
            generateGroundedAnswer: async () => {
                generationCount += 1;
                return ANSWERED;
            },
            finalizeAnswered: async (input) => {
                finalizeCount += 1;
                completed = input.response;
                return { kind: 'finalized' as const };
            },
            writeValidatedConversationState: async () => {
                stateWriteCount += 1;
            },
        });

        assert.deepEqual(await run(value), ANSWERED);
        assert.deepEqual(await run(value), ANSWERED);
        assert.equal(claimCount, 1);
        assert.equal(generationCount, 1);
        assert.equal(finalizeCount, 1);
        assert.equal(stateWriteCount, 1);
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

    it('normalizes abstention semantics before citations, usage finalization, and conversation state', async () => {
        const traces: NoorSanitizedTrace[] = [];
        let stateWrites = 0;
        const value = harness({
            generateGroundedAnswer: async () => ({
                ...ANSWERED,
                answer: 'I could not find enough reliable tafsir evidence to answer that safely.',
            }),
            writeValidatedConversationState: async () => { stateWrites += 1; },
            emitSanitizedTrace: trace => { traces.push(trace); },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'Which current investment is doing well now?',
            history: [],
        });

        assert.equal(response.status, 'insufficient_evidence');
        assert.deepEqual(response.citations, []);
        assert.equal(stateWrites, 0);
        assert.ok(value.events.includes('finalize-non-answer'));
        assert.ok(!value.events.includes('finalize-answered'));
        assert.equal((traces[0] as unknown as { outcomeNormalizationReason?: string })?.outcomeNormalizationReason, 'abstention_language');
        assert.equal((traces[0] as unknown as { stateAction?: string })?.stateAction, 'unchanged');
    });

    it('strips citations from an explicitly typed generated non-answer', async () => {
        let stateWrites = 0;
        const value = harness({
            generateGroundedAnswer: async () => ({
                ...ANSWERED,
                status: 'insufficient_evidence',
                answer: 'The supplied evidence is insufficient for this request.',
            }),
            writeValidatedConversationState: async () => { stateWrites += 1; },
        });

        const response = await run(value);
        assert.equal(response.status, 'insufficient_evidence');
        assert.deepEqual(response.citations, []);
        assert.equal(stateWrites, 0);
        assert.ok(value.events.includes('finalize-non-answer'));
        assert.ok(!value.events.includes('finalize-answered'));
    });

    it('executes explicit whole-Surah synthesis even when the phrasing contains a pronoun', async () => {
        let summaryCalls = 0;
        let generationCalls = 0;
        const summaryEvidence = [1, 30, 60, 111].map((verse, index) => ({
            ...EVIDENCE[0]!,
            promptSourceId: `S${index + 1}`,
            chunk: {
                ...chunk(`yusuf-summary-${index}`, `Distinct Yusuf summary concept ${index}`),
                canonicalUnitId: `unit-yusuf-${index}`,
                surah: 12,
                verseStart: verse,
                verseEnd: verse,
            },
        } satisfies RetrievedEvidence));
        const value = harness({
            retrieveEntitySummary: async () => {
                summaryCalls += 1;
                return {
                    evidence: summaryEvidence,
                    candidateCount: 4,
                    anchorVerses: [1, 30, 60, 111],
                    coverageCapacity: { canonicalUnits: 4, sections: 4, span: 110 },
                };
            },
            generateGroundedAnswer: async input => {
                generationCalls += 1;
                return {
                    requestId: input.request.requestId,
                    status: 'answered',
                    answer: 'Grounded whole-Surah synthesis.',
                    citations: input.evidence.map(item => ({
                        chunkId: item.chunk.chunkId,
                        canonicalUnitId: item.chunk.canonicalUnitId,
                        source: item.chunk.source,
                        sourceTitle: item.chunk.sourceTitle,
                        surah: item.chunk.surah,
                        verseStart: item.chunk.verseStart,
                        verseEnd: item.chunk.verseEnd,
                        corpusVersion: item.chunk.corpusVersion,
                    })),
                };
            },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'Explain Surah Yusuf like I know nothing about it.',
            history: [],
        });
        assert.equal(response.status, 'answered');
        assert.equal(summaryCalls, 1);
        assert.equal(generationCalls, 1);
        assert.ok(!value.events.includes('semantic'));
    });

    it('enforces explicit Surah containment on the ordinary point path', async () => {
        const maryam = {
            ...EVIDENCE[0]!,
            chunk: {
                ...chunk('a-maryam', 'Maryam happened within this requested Surah Maryam passage.'),
                canonicalUnitId: 'unit-maryam',
                surah: 19,
                verseStart: 16,
                verseEnd: 16,
            },
        } satisfies RetrievedEvidence;
        const crossSurah = {
            ...EVIDENCE[0]!,
            promptSourceId: 'S2',
            chunk: {
                ...chunk('b-cross-surah', 'Maryam happened and is mentioned in this other passage.'),
                canonicalUnitId: 'unit-cross-surah',
                surah: 21,
                verseStart: 91,
                verseEnd: 91,
            },
        } satisfies RetrievedEvidence;
        let selected: readonly RetrievedEvidence[] = [];
        const value = harness({
            retrieveSemantic: async () => ({
                evidence: [maryam, crossSurah],
                vectorHitCount: 2,
                lexicalHitCount: 2,
                lexicalSearchStatus: 'available' as const,
            }),
            generateGroundedAnswer: async input => {
                selected = input.evidence;
                const item = input.evidence[0]!;
                return {
                    requestId: input.request.requestId,
                    status: 'answered',
                    answer: 'Grounded Maryam answer. [S1]',
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

        const response = await run(value, { ...REQUEST, question: 'What happened in Surah Maryam?', history: [] });
        assert.equal(response.status, 'answered');
        assert.deepEqual(selected.map(item => item.chunk.surah), [19]);
        assert.deepEqual(response.citations.map(item => item.surah), [19]);
    });

    it('keeps explicit Surah containment across bounded recovery retrieval', async () => {
        const crossSurah = {
            ...EVIDENCE[0]!,
            chunk: {
                ...chunk('cross-recovery', 'Maryam appears in this different Surah passage.'),
                canonicalUnitId: 'unit-cross-recovery',
                surah: 21,
                verseStart: 91,
                verseEnd: 91,
            },
        } satisfies RetrievedEvidence;
        let retrievals = 0;
        const value = harness({
            retrieveSemantic: async () => {
                retrievals += 1;
                return {
                    evidence: [crossSurah],
                    vectorHitCount: 1,
                    lexicalHitCount: 1,
                    lexicalSearchStatus: 'available' as const,
                };
            },
            generateGroundedAnswer: async () => { throw new Error('generation must not receive cross-Surah evidence'); },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'What happened in Surah Maryam?',
            history: [],
            verseContext: { surah: 19, verse: 16 },
        });
        assert.equal(response.status, 'insufficient_evidence');
        assert.equal(retrievals, 2);
        assert.ok(!value.events.includes('model'));
    });

    it('retrieves balanced evidence through one bounded branch per requested entity', async () => {
        const nuh = {
            ...EVIDENCE[0]!,
            chunk: { ...chunk('nuh-branch', 'Nuh story patience warning people'), canonicalUnitId: 'unit-nuh', surah: 71, verseStart: 1, verseEnd: 1 },
        } satisfies RetrievedEvidence;
        const musa = {
            ...EVIDENCE[0]!,
            chunk: { ...chunk('musa-branch', 'Musa story signs Pharaoh people'), canonicalUnitId: 'unit-musa', surah: 20, verseStart: 9, verseEnd: 9 },
        } satisfies RetrievedEvidence;
        const queries: string[] = [];
        let selected: readonly RetrievedEvidence[] = [];
        const value = harness({
            retrieveSemantic: async input => {
                queries.push(input.query);
                const item = /musa/iu.test(input.query) && !/nuh/iu.test(input.query) ? musa : nuh;
                return { evidence: [item], vectorHitCount: 1, lexicalHitCount: 1, lexicalSearchStatus: 'available' as const };
            },
            generateGroundedAnswer: async input => {
                selected = input.evidence;
                return {
                    requestId: input.request.requestId,
                    status: 'answered',
                    answer: 'The two grounded story paths differ. [S1, S2]',
                    citations: input.evidence.map(item => ({
                        chunkId: item.chunk.chunkId,
                        canonicalUnitId: item.chunk.canonicalUnitId,
                        source: item.chunk.source,
                        sourceTitle: item.chunk.sourceTitle,
                        surah: item.chunk.surah,
                        verseStart: item.chunk.verseStart,
                        verseEnd: item.chunk.verseEnd,
                        corpusVersion: item.chunk.corpusVersion,
                    })),
                };
            },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'How are the stories of Nuh and Musa different?',
            history: [],
        });
        assert.equal(response.status, 'answered');
        assert.equal(queries.length, 2);
        assert.ok(queries.some(query => /nuh/iu.test(query) && !/musa/iu.test(query)));
        assert.ok(queries.some(query => /musa/iu.test(query) && !/nuh/iu.test(query)));
        assert.deepEqual(new Set(selected.map(item => item.chunk.chunkId)), new Set(['nuh-branch', 'musa-branch']));
    });

    it('rejects distinct incidental name mentions as substantive entity-branch support', async () => {
        const shared = {
            ...EVIDENCE[0]!,
            chunk: {
                ...chunk('shared-incidental', 'Nuh and Musa are both named incidentally.'),
                canonicalUnitId: 'unit-shared-incidental',
                surah: 7,
            },
        } satisfies RetrievedEvidence;
        const secondShared = {
            ...shared,
            promptSourceId: 'S2',
            chunk: {
                ...shared.chunk,
                chunkId: 'second-incidental',
                canonicalUnitId: 'unit-second-incidental',
                retrievalText: 'Musa and Nuh are listed together incidentally.',
                originalText: 'Musa and Nuh are listed together incidentally.',
            },
        } satisfies RetrievedEvidence;
        const value = harness({
            retrieveSemantic: async () => ({
                evidence: [shared, secondShared], vectorHitCount: 2, lexicalHitCount: 2, lexicalSearchStatus: 'available' as const,
            }),
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'How are the stories of Nuh and Musa different?',
            history: [],
        });
        assert.equal(response.status, 'insufficient_evidence');
        assert.ok(!value.events.includes('model'));
    });

    it('rejects a multi-entity answer whose final citations support only one requested entity', async () => {
        const nuh = {
            ...EVIDENCE[0]!,
            chunk: { ...chunk('nuh-final', 'Nuh story called his people patiently.'), canonicalUnitId: 'unit-nuh-final', surah: 71 },
        } satisfies RetrievedEvidence;
        const musa = {
            ...EVIDENCE[0]!,
            chunk: { ...chunk('musa-final', 'Musa story confronted Pharaoh with signs.'), canonicalUnitId: 'unit-musa-final', surah: 20 },
        } satisfies RetrievedEvidence;
        const value = harness({
            retrieveSemantic: async input => ({
                evidence: [/musa/iu.test(input.query) && !/nuh/iu.test(input.query) ? musa : nuh],
                vectorHitCount: 1,
                lexicalHitCount: 1,
                lexicalSearchStatus: 'available' as const,
            }),
            generateGroundedAnswer: async input => {
                const cited = input.evidence.find(item => /nuh/iu.test(item.chunk.retrievalText))!;
                return {
                    requestId: input.request.requestId,
                    status: 'answered',
                    answer: 'A superficially balanced answer with one-sided citations.',
                    citations: [{
                        chunkId: cited.chunk.chunkId,
                        canonicalUnitId: cited.chunk.canonicalUnitId,
                        source: cited.chunk.source,
                        sourceTitle: cited.chunk.sourceTitle,
                        surah: cited.chunk.surah,
                        verseStart: cited.chunk.verseStart,
                        verseEnd: cited.chunk.verseEnd,
                        corpusVersion: cited.chunk.corpusVersion,
                    }],
                };
            },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'How are the stories of Nuh and Musa different?',
            history: [],
        });
        assert.equal(response.status, 'temporarily_unavailable');
        assert.ok(value.events.includes('finalize-non-answer'));
        assert.ok(!value.events.includes('finalize-answered'));
    });

    it('performs one bounded recovery retrieval and generates only from relevant evidence', async () => {
        const unrelated = {
            ...EVIDENCE[0]!,
            kind: 'semantic',
            chunk: chunk('unrelated', 'Al-Qasas contains an unrelated story.'),
            similarity: CONFIG.sourceThresholds.ibn_kathir_en_abridged,
        } satisfies RetrievedEvidence;
        const relevant = {
            ...EVIDENCE[0]!,
            chunk: chunk('baqarah-2-1', 'Virtues of Surat Al-Baqarah are discussed in Ibn Kathir.'),
        } satisfies RetrievedEvidence;
        const firstRequest = {
            ...REQUEST,
            requestId: '33333333-3333-4333-8333-333333333333',
            question: 'Tell me about Surah Al-Baqarah.',
            history: [],
        } satisfies Extract<NoorRequest, { mode: 'chat' }>;
        const state = createValidatedConversationState({
            request: firstRequest,
            response: {
                requestId: firstRequest.requestId,
                status: 'answered',
                answer: 'Grounded introduction. [S1]',
                citations: [{
                    chunkId: relevant.chunk.chunkId,
                    canonicalUnitId: relevant.chunk.canonicalUnitId,
                    source: relevant.chunk.source,
                    sourceTitle: relevant.chunk.sourceTitle,
                    surah: relevant.chunk.surah,
                    verseStart: relevant.chunk.verseStart,
                    verseEnd: relevant.chunk.verseEnd,
                    corpusVersion: relevant.chunk.corpusVersion,
                }],
            },
            evidence: [relevant],
        });
        assert.ok(state);
        const queries: string[] = [];
        let generatedEvidence: readonly RetrievedEvidence[] = [];
        const value = harness({
            retrieveSemantic: async input => {
                queries.push(input.query);
                return queries.length <= 2
                    ? { evidence: [unrelated], vectorHitCount: 1, lexicalHitCount: 1, lexicalSearchStatus: 'available' }
                    : { evidence: [relevant], vectorHitCount: 1, lexicalHitCount: 1, lexicalSearchStatus: 'available' };
            },
            readValidatedConversationState: async () => state,
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
            question: 'But what is its significance in Islam?',
            history: [
                { role: 'user', content: firstRequest.question },
                { role: 'assistant', content: 'Grounded introduction.' },
            ],
        });

        assert.equal(response.status, 'answered');
        assert.equal(queries.length, 3);
        assert.equal(queries[2], 'surah al-baqarah');
        assert.doesNotMatch(queries[2]!, /Quran tafsir/i);
        assert.deepEqual(generatedEvidence.map(item => item.chunk.chunkId), ['baqarah-2-1']);
    });

    it('keeps a strong semantic Noah/Nuh result when the user uses the English name', async () => {
        const noah = {
            ...EVIDENCE[0]!,
            kind: 'semantic',
            chunk: chunk(
                'c_0ad0b17c1dc61edfe7924318e1cb73dfeaf1c32415783dde9fe71b99bba1f8e4_000_e29e57df16f7',
                'Nuh and His PeopleWhen Allah tells us about the story of Nuh and the rejection of his people.',
            ),
            similarity: 0.7774966340151523,
        } satisfies RetrievedEvidence;
        let retrievalCount = 0;
        let modelCalled = false;
        const value = harness({
            loadRuntimeConfig: async () => ({
                ...CONFIG,
                sourceThresholds: { ibn_kathir_en_abridged: 0.72, al_sadi_ar: 0.76 },
            }),
            retrieveSemantic: async () => {
                retrievalCount += 1;
                return { evidence: [noah], vectorHitCount: 1, lexicalHitCount: 0, lexicalSearchStatus: 'available' };
            },
            generateGroundedAnswer: async () => {
                modelCalled = true;
                return ANSWERED;
            },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'Tell me about Noah.',
            history: [],
        });

        assert.equal(response.status, 'answered');
        assert.equal(retrievalCount, 1);
        assert.equal(modelCalled, true);
    });

    it('abstains without retry when weak evidence has no useful reformulation signal', async () => {
        const unrelated = {
            ...EVIDENCE[0]!,
            kind: 'semantic',
            chunk: chunk('unrelated', 'Al-Qasas contains an unrelated story.'),
            similarity: CONFIG.sourceThresholds.ibn_kathir_en_abridged,
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
        assert.equal(queries.length, 1);
        assert.equal(modelCalled, false);
        assert.deepEqual(response.citations, []);
    });

    it('keeps a genuine initial retrieval provider error distinct from unsupported abstention', async () => {
        let retrievalCount = 0;
        const value = harness({
            retrieveSemantic: async () => {
                retrievalCount += 1;
                throw new Error('embedding provider unavailable');
            },
        });

        const response = await run(value, {
            ...REQUEST,
            question: 'What was the latest football score?',
            history: [],
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.equal(retrievalCount, 1);
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
        const trace = traces.at(-1);
        assert.equal(trace?.citationValidation, 'failed');
        assert.equal(trace?.generationAttemptCount, 2);
        assert.equal(trace?.generationFailurePhase, 'citation_validation');
        assert.equal(trace?.structuralValidationResult, 'passed_after_retry');
        assert.equal(trace?.citationValidationResult, 'failed');
        assert.equal(trace?.citationValidationFailureSubtype, 'unknown_citation_id');
        assert.equal(trace?.qualityJudgeInvoked, false);
        assert.equal(trace?.correctionInvoked, false);
        assert.equal(trace?.finalGenerationErrorClass, 'citation_validation_failure');
        assert.doesNotMatch(JSON.stringify(trace), /Grounded\. \[S9\]/);
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
            'citationCount', 'citationValidationFailureSubtype', 'citationValidationResult', 'corpusVersion',
            'correctionInvoked', 'durationMs', 'entitlementClass', 'errorClass', 'finalGenerationErrorClass',
            'generationAttemptCount', 'generationFailurePhase', 'generationModel', 'generationMs',
            'generationRetryInvoked', 'mode', 'outcome', 'promptVersion', 'qualityJudgeInvoked',
            'requestId', 'retrievalMs', 'retrievedChunkIds', 'structuralValidationResult',
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
            { results: ['{"answer":"Incomplete answer"}', '{"answer":"Incomplete answer"}'], status: 'temporarily_unavailable', errorClass: 'answer_validation_failure' },
            { results: [Object.assign(new Error('DEADLINE_EXCEEDED provider-secret'), { code: 'DEADLINE_EXCEEDED' })], status: 'temporarily_unavailable', errorClass: 'provider_timeout' },
            { results: [Object.assign(new Error('temporary upstream failure'), { status: 503 }), '{"answer":"Grounded answer. [S1]","citationIds":["S1"]}', QUALITY_PASS], status: 'answered', errorClass: null },
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
