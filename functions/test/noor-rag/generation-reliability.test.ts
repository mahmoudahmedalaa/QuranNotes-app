import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    generateGroundedAnswer,
    getGenerationDiagnostics,
    type GenerationProvider,
    type VertexGenerationRequest,
} from '../../src/noor-rag/generation';
import type { NoorRequest, RetrievedEvidence } from '../../src/noor-rag/types';

const REQUEST_ID = '6ba7b810-9dad-41d1-80b4-00c04fd430c8';
const REQUEST: NoorRequest = { mode: 'chat', requestId: REQUEST_ID, question: 'Explain patience', history: [] };
const QUALITY_PASS = JSON.stringify({
    grounded: true,
    answersQuestion: true,
    preservesMaterialQualifications: true,
    materiallyMisleading: false,
    clear: true,
    citationConsistent: true,
});

function evidence(id = 'S1'): RetrievedEvidence {
    return {
        kind: 'exact', promptSourceId: id,
        chunk: {
            chunkId: `chunk-${id}`, canonicalUnitId: `unit-${id}`, chunkIndex: 0,
            source: 'al_sadi_ar', sourceTitle: "Tafsir Al-Sa'di", language: 'ar', surah: 2,
            verseStart: 153, verseEnd: 153, originalStart: 0, originalEnd: 18,
            originalText: 'Arabic tafsir evidence', retrievalText: 'Arabic tafsir evidence',
            corpusVersion: 'v1', contentHash: 'hash', tokenCount: 3,
            embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
        },
    };
}

class SequenceProvider implements GenerationProvider {
    readonly requests: VertexGenerationRequest[] = [];
    constructor(private readonly results: Array<string | Error>) {}
    async generate(request: VertexGenerationRequest): Promise<string> {
        this.requests.push(request);
        const result = this.results.shift();
        if (result instanceof Error) throw result;
        if (result === undefined) throw new Error('fixture exhausted');
        return result;
    }
}

function providerError(message: string, fields: Record<string, unknown>): Error {
    return Object.assign(new Error(message), fields);
}

describe('Noor generation reliability diagnostics', () => {
    const input = (provider: GenerationProvider) => ({
        request: REQUEST, evidence: [evidence()], maxEvidenceCharacters: 1000, provider,
    });

    it('classifies a transient provider failure while preserving a grounded success', async () => {
        const provider = new SequenceProvider([providerError('temporary upstream failure', { status: 503 }), '{"answer":"Grounded. [S1]","citationIds":["S1"]}', QUALITY_PASS]);
        const answer = await generateGroundedAnswer(input(provider));
        assert.equal(answer.status, 'answered');
        assert.equal(getGenerationDiagnostics(answer)?.errorClass, null);
        assert.equal(provider.requests.length, 3);
    });

    it('classifies malformed JSON with a safe unavailable answer', async () => {
        const provider = new SequenceProvider(['not-json', 'still-not-json']);
        const answer = await generateGroundedAnswer(input(provider));
        assert.equal(answer.status, 'temporarily_unavailable');
        assert.equal(getGenerationDiagnostics(answer)?.errorClass, 'malformed_json');
        assert.deepEqual(answer.citations, []);
    });

    it('classifies citation and answer validation failures separately', async () => {
        const citationProvider = new SequenceProvider(['{"answer":"Grounded. [S9]","citationIds":["S9"]}', '{"answer":"Grounded. [S9]","citationIds":["S9"]}']);
        const citationFailure = await generateGroundedAnswer(input(citationProvider));
        assert.equal(citationFailure.status, 'temporarily_unavailable');
        assert.equal(getGenerationDiagnostics(citationFailure)?.errorClass, 'citation_validation_failure');

        const answerProvider = new SequenceProvider(['{"answer":"Uncited answer","citationIds":[]}', '{"answer":"Uncited answer","citationIds":[]}']);
        const answerFailure = await generateGroundedAnswer(input(answerProvider));
        assert.equal(answerFailure.status, 'temporarily_unavailable');
        assert.equal(getGenerationDiagnostics(answerFailure)?.errorClass, 'answer_validation_failure');
    });

    it('classifies provider timeout without retrying or leaking provider details', async () => {
        const provider = new SequenceProvider([Object.assign(new Error('DEADLINE_EXCEEDED provider-secret-body'), { code: 'DEADLINE_EXCEEDED' })]);
        const answer = await generateGroundedAnswer(input(provider));
        assert.equal(answer.status, 'temporarily_unavailable');
        assert.equal(getGenerationDiagnostics(answer)?.errorClass, 'provider_timeout');
        assert.equal(provider.requests.length, 1);
        assert.doesNotMatch(answer.answer, /DEADLINE|secret|provider/i);
    });

    it('fails permanent provider errors once without retrying or leaking provider details', async () => {
        for (const error of [
            providerError('bad request with secret', { status: 400 }),
            providerError('unauthorized provider body', { status: 401 }),
            providerError('forbidden provider body', { status: 403 }),
            providerError('invalid argument provider body', { code: 'INVALID_ARGUMENT' }),
            providerError('permission denied provider body', { code: 'PERMISSION_DENIED' }),
            providerError('resource exhausted provider body', { code: 'RESOURCE_EXHAUSTED' }),
            providerError('aborted provider body', { code: 'ABORTED' }),
            providerError('internal provider body', { code: 'INTERNAL' }),
        ]) {
            const provider = new SequenceProvider([error]);
            const answer = await generateGroundedAnswer(input(provider));
            assert.equal(answer.status, 'temporarily_unavailable');
            assert.equal(getGenerationDiagnostics(answer)?.errorClass, 'provider_permanent_failure');
            assert.equal(provider.requests.length, 1);
            assert.doesNotMatch(answer.answer, /secret|provider|unauthorized|forbidden/i);
        }
    });

    it('retries explicitly transient numeric provider statuses exactly once', async () => {
        for (const status of [429, 500, 502, 503, 'UNAVAILABLE']) {
            const provider = new SequenceProvider([
                providerError(`transient ${status}`, { status }),
                '{"answer":"Grounded. [S1]","citationIds":["S1"]}',
                QUALITY_PASS,
            ]);
            const answer = await generateGroundedAnswer(input(provider));
            assert.equal(answer.status, 'answered');
            assert.equal(provider.requests.length, 3);
        }
        const timeoutMessage = new SequenceProvider([
            providerError('timeout wording but retryable status', { status: 500 }),
            '{"answer":"Grounded. [S1]","citationIds":["S1"]}',
            QUALITY_PASS,
        ]);
        assert.equal((await generateGroundedAnswer(input(timeoutMessage))).status, 'answered');
        assert.equal(timeoutMessage.requests.length, 3);
        const nearDeadlineCode = new SequenceProvider([
            providerError('near deadline code', { status: 500, code: 'NOT_DEADLINE_EXCEEDED' }),
            '{"answer":"Grounded. [S1]","citationIds":["S1"]}',
            QUALITY_PASS,
        ]);
        assert.equal((await generateGroundedAnswer(input(nearDeadlineCode))).status, 'answered');
        assert.equal(nearDeadlineCode.requests.length, 3);
    });

    it('treats numeric 408 and 504 and timeout names as non-retryable timeouts', async () => {
        for (const error of [
            providerError('request timeout', { status: 408 }),
            providerError('gateway timeout', { status: 504 }),
            providerError('deadline exceeded', { code: 'DEADLINE_EXCEEDED' }),
            providerError('deadline exceeded status', { status: 'DEADLINE_EXCEEDED' }),
            providerError('aborted', { name: 'AbortError' }),
        ]) {
            const provider = new SequenceProvider([error]);
            const answer = await generateGroundedAnswer(input(provider));
            assert.equal(answer.status, 'temporarily_unavailable');
            assert.equal(getGenerationDiagnostics(answer)?.errorClass, 'provider_timeout');
            assert.equal(provider.requests.length, 1);
        }
    });
});
