import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { parseGoldenManifest } from '../../scripts/noor-rag/golden';

describe('Noor golden manifest', () => {
    it('requires source-derived evidence expectations for every positive case', () => {
        assert.throws(() => parseGoldenManifest({
            schemaVersion: 1,
            corpusVersion: '2026-08-10-v1',
            topK: 8,
            cases: [{
                id: 'positive',
                category: 'direct',
                turns: ['What does the Quran say about patience?'],
                expectedStatus: 'answered',
                expectedEvidence: [],
                forbiddenChunkIds: [],
                forbiddenStatuses: ['insufficient_evidence'],
            }],
        }), /expectedEvidence/);
    });

    it('requires explicit forbidden behavior for abstention and policy cases', () => {
        assert.throws(() => parseGoldenManifest({
            schemaVersion: 1,
            corpusVersion: '2026-08-10-v1',
            topK: 8,
            cases: [{
                id: 'negative',
                category: 'unsupported',
                turns: ['What is the latest football score?'],
                expectedStatus: 'insufficient_evidence',
                forbiddenChunkIds: [],
            }],
        }), /forbiddenStatuses/);
    });

    it('parses the checked-in high-value case set', () => {
        const path = resolve(__dirname, '../../../evals/noor-golden-cases.json');
        const manifest = parseGoldenManifest(JSON.parse(readFileSync(path, 'utf8')) as unknown);
        assert.ok(manifest.cases.length >= 12);
        assert.ok(manifest.cases.length <= 20);
        assert.equal(manifest.cases.every(item => item.expectedStatus), true);
    });
});
