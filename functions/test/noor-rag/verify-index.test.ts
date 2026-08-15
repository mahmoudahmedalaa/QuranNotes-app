import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    LOCKED_CORPUS_VERSION,
    LOCKED_PROJECT,
    LOCKED_SOURCES,
    createDeterministicProbeVector,
    parseIndexArguments,
    verifyIndex,
    type IndexProbe,
    type IndexProbeRequest,
} from '../../scripts/noor-rag/verify-index';

describe('Noor production vector and lexical index verification', () => {
    it('requires the exact explicit production project and corpus version', () => {
        assert.throws(() => parseIndexArguments([]), /project/);
        assert.throws(() => parseIndexArguments([`--project=${LOCKED_PROJECT}`]), /version/);
        assert.throws(() => parseIndexArguments(['--project=wrong', `--version=${LOCKED_CORPUS_VERSION}`]), /project/);
        assert.throws(() => parseIndexArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`, '--source=al_sadi_ar',
        ]), /Unknown/);
        assert.deepEqual(parseIndexArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
        ]), { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION });
    });

    it('uses one deterministic nonzero 768-dimensional vector for both filtered limit-one queries', async () => {
        const calls: IndexProbeRequest[] = [];
        const probe: IndexProbe = {
            query: async request => {
                calls.push(request);
                return { count: 1, corpusVersion: request.version, source: request.source, lexicalCount: 1 };
            },
        };
        const result = await verifyIndex({
            options: parseIndexArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`]),
            probe,
        });

        assert.deepEqual(result, { ready: true, exitCode: 0, checkedSources: [...LOCKED_SOURCES] });
        assert.deepEqual(calls.map(call => call.source), [...LOCKED_SOURCES]);
        assert.ok(calls.every(call => call.limit === 1 && call.version === LOCKED_CORPUS_VERSION));
        assert.deepEqual(calls[0]!.vector, calls[1]!.vector);
        assert.deepEqual(calls[0]!.vector, createDeterministicProbeVector());
        assert.equal(calls[0]!.vector.length, 768);
        assert.ok(calls[0]!.vector.some(value => value !== 0));
    });

    it('returns nonzero when either source is empty, mismatched, or FAILED_PRECONDITION', async () => {
        for (const query of [
            async (request: IndexProbeRequest) => ({ count: request.source === 'al_sadi_ar' ? 0 : 1, corpusVersion: request.version, source: request.source, lexicalCount: 1 }),
            async (request: IndexProbeRequest) => ({ count: 1, corpusVersion: 'wrong', source: request.source, lexicalCount: 1 }),
            async (request: IndexProbeRequest) => ({ count: 1, corpusVersion: request.version, source: request.source, lexicalCount: 0 }),
            async () => { throw Object.assign(new Error('index building'), { code: 9, details: 'FAILED_PRECONDITION' }); },
        ]) {
            const result = await verifyIndex({
                options: { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION },
                probe: { query },
            });
            assert.equal(result.ready, false);
            assert.equal(result.exitCode, 1);
        }
    });
});
