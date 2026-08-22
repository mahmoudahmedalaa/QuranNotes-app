import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
    buildNoorEvaluationExpectations,
    parseNoorEvaluationManifest,
    type NoorEvaluationManifest,
} from '../../scripts/noor-rag/evaluation-cases';

const MANIFEST: NoorEvaluationManifest = {
    schemaVersion: 1,
    cases: [{
        id: 'direct-concept',
        family: 'direct-concept',
        variants: [
            { turns: ['What is patience in the Quran?'] },
            { turns: ['Explain sabr in Quranic context.'] },
        ],
        expected: { allowedStatuses: ['answered', 'insufficient_evidence'] },
    }],
};

describe('Noor external evaluation cases', () => {
    it('ships a broad external matrix without making it part of runtime policy', () => {
        const manifest = parseNoorEvaluationManifest(JSON.parse(readFileSync(resolve(
            __dirname, '../../../evals/noor-evaluation-cases.json',
        ), 'utf8')) as unknown);
        assert.ok(manifest.cases.length >= 10);
        assert.ok(manifest.cases.some(item => item.family === 'structural-follow-up'));
        assert.ok(manifest.cases.some(item => item.family === 'paraphrase-and-language-variant'));
        assert.ok(manifest.cases.some(item => item.family === 'entity-wide-synthesis'));
        assert.ok(manifest.cases.some(item => item.family.startsWith('safety-control-')));
        for (const id of [
            'regression-noah',
            'regression-riba',
            'regression-riba-follow-up',
            'regression-al-baqarah-significance',
            'regression-football',
            'regression-wudu-ambiguity',
            'regression-exact-verse',
            'regression-policy-refusal',
        ]) {
            assert.ok(manifest.cases.some(item => item.id === id), `missing ${id}`);
        }
        assert.equal(Object.keys(buildNoorEvaluationExpectations(manifest)).length, manifest.cases.length);
    });

    it('accepts bounded arbitrary behavior families and exposes expectations without prompts', () => {
        const parsed = parseNoorEvaluationManifest(MANIFEST);
        assert.deepEqual(buildNoorEvaluationExpectations(parsed), {
            'direct-concept': { allowedStatuses: ['answered', 'insufficient_evidence'] },
        });
        const serialized = JSON.stringify(buildNoorEvaluationExpectations(parsed));
        assert.doesNotMatch(serialized, /patience|sabr/i);
    });

    it('rejects malformed, duplicate, oversized, or empty variants', () => {
        assert.throws(() => parseNoorEvaluationManifest({}), /schemaVersion|cases/);
        assert.throws(() => parseNoorEvaluationManifest({ ...MANIFEST, cases: [MANIFEST.cases[0], MANIFEST.cases[0]] }), /duplicate/i);
        assert.throws(() => parseNoorEvaluationManifest({ ...MANIFEST, cases: [{ ...MANIFEST.cases[0], variants: [] }] }), /variant/i);
        assert.throws(() => parseNoorEvaluationManifest({
            ...MANIFEST,
            cases: [{ ...MANIFEST.cases[0], variants: [{ turns: [''] }] }],
        }), /turn/i);
    });
});
