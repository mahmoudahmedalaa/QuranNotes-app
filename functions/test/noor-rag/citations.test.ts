import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    diagnoseGeneratedAnswer,
    parseAndValidateGeneratedAnswer,
    validateGeneratedAnswer,
    type GeneratedAnswerValidationOptions,
} from '../../src/noor-rag/citations';
import type { RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

function evidence(promptSourceId: string, overrides: Partial<TafsirChunk> = {}): RetrievedEvidence {
    return {
        kind: 'exact', promptSourceId,
        chunk: {
            chunkId: `chunk-${promptSourceId}`, canonicalUnitId: `unit-${promptSourceId}`, chunkIndex: 0,
            source: 'al_sadi_ar', sourceTitle: "Tafsir Al-Sa'di", language: 'ar', surah: 2,
            verseStart: 153, verseEnd: 153, originalStart: 0, originalEnd: 12,
            originalText: 'Arabic source', retrievalText: 'Arabic source', corpusVersion: 'v1',
            contentHash: 'hash', tokenCount: 3, embeddingModel: 'gemini-embedding-2', embeddingDimension: 768,
            ...overrides,
        },
    };
}

const EVIDENCE = [
    evidence('S1'),
    evidence('S2', { source: 'ibn_kathir_en_abridged', sourceTitle: 'Tafsir Ibn Kathir', language: 'en' }),
];

const COMPARISON_EVIDENCE = [
    evidence('S1', { chunkId: 'nuh-1', canonicalUnitId: 'nuh-unit-1', surah: 10 }),
    evidence('S2', { chunkId: 'nuh-2', canonicalUnitId: 'nuh-unit-2', surah: 23 }),
    evidence('S3', { chunkId: 'musa-1', canonicalUnitId: 'musa-unit-1', surah: 20 }),
    evidence('S4', { chunkId: 'musa-2', canonicalUnitId: 'musa-unit-2', surah: 28 }),
    evidence('S5', { chunkId: 'third-entity', canonicalUnitId: 'third-unit', surah: 12 }),
];

const COMPARISON_OPTIONS = {
    requireInlineCitations: true,
    comparisonCitationContract: {
        taskType: 'multi_entity_comparison',
        entities: [
            { id: 'subject:nuh', label: 'Nuh', evidenceIds: ['S1', 'S2'] },
            { id: 'subject:musa', label: 'Musa', evidenceIds: ['S3', 'S4'] },
        ],
        allowedEvidenceIds: ['S1', 'S2', 'S3', 'S4'],
    },
} as unknown as GeneratedAnswerValidationOptions;

describe('Noor generated citation validation', () => {
    it('accepts valid single and multi-source answers and maps only cited metadata', () => {
        const single = validateGeneratedAnswer({ answer: 'Al-Sa\'di explains this meaning in English paraphrase. [S1]', citationIds: ['S1'] }, EVIDENCE);
        assert.deepEqual(single.citations, [{
            chunkId: 'chunk-S1', canonicalUnitId: 'unit-S1', source: 'al_sadi_ar',
            sourceTitle: "Tafsir Al-Sa'di", surah: 2, verseStart: 153, verseEnd: 153, corpusVersion: 'v1',
        }]);
        const multi = validateGeneratedAnswer({
            answer: 'The first explanation emphasizes steadfastness. [S1]\n\nThe second adds context. [S2]',
            citationIds: ['S1', 'S2'],
        }, EVIDENCE);
        assert.equal(multi.citations.length, 2);
    });

    it('accepts structured citation ids when the client renders citation metadata separately', () => {
        const result = validateGeneratedAnswer({
            answer: 'Al-Sa\'di explains this meaning in an English paraphrase.',
            citationIds: ['S1'],
        }, EVIDENCE);

        assert.equal(result.answer, 'Al-Sa\'di explains this meaning in an English paraphrase.');
        assert.deepEqual(result.citationIds, ['S1']);
        assert.equal(result.citations[0]?.chunkId, 'chunk-S1');
    });

    it('accepts grouped inline source markers when every marker maps to declared evidence', () => {
        const result = validateGeneratedAnswer({
            answer: 'Both sources support the first claim. [S1, S2]\n\nThe second source adds context. [S2]',
            citationIds: ['S1', 'S2'],
        }, EVIDENCE);

        assert.deepEqual(result.citationIds, ['S1', 'S2']);
        assert.deepEqual(result.citations.map(citation => citation.chunkId), ['chunk-S1', 'chunk-S2']);
    });

    it('rejects malformed JSON and extra top-level keys', () => {
        assert.throws(() => parseAndValidateGeneratedAnswer('{bad', EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S1]', citationIds: ['S1'], details: 'provider body' }, EVIDENCE), /invalid generated answer/i);
    });

    it('rejects unknown, unused, duplicate, and uncited citations', () => {
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S9]', citationIds: ['S9'] }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S0]', citationIds: ['S0'] }, [evidence('S0')]), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S1]', citationIds: ['S1', 'S2'] }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Claim. [S1]', citationIds: ['S1', 'S1'] }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({ answer: 'Supported. [S1]\n\nSubstantive uncited claim.', citationIds: ['S1'] }, EVIDENCE), /invalid generated answer/i);
    });

    it('classifies absent and malformed inline markers when synthesis requires claim-local citations', () => {
        assert.equal(diagnoseGeneratedAnswer(
            { answer: 'Grounded synthesis without markers.', citationIds: ['S1'] },
            EVIDENCE,
            { requireInlineCitations: true },
        )?.citationSubtype, 'missing_required_citation');
        assert.equal(diagnoseGeneratedAnswer(
            { answer: 'Grounded synthesis with malformed marker. [S 1]', citationIds: ['S1'] },
            EVIDENCE,
            { requireInlineCitations: true },
        )?.citationSubtype, 'malformed_citation');
    });

    it('accepts formatting-only comparison headings and claim-local branch citations', () => {
        assert.equal(diagnoseGeneratedAnswer({
            status: 'answered',
            answer: [
                '## Comparison of Nuh and Musa',
                '## Nuh',
                'Nuh faced rejection from his people. [S1]',
                '## Musa',
                'Musa confronted Pharaoh. [S3]',
                'Nuh and Musa faced different opponents and circumstances. [S1, S3]',
            ].join('\n\n'),
            citationIds: ['S1', 'S3'],
        }, COMPARISON_EVIDENCE, COMPARISON_OPTIONS), null);

        assert.equal(diagnoseGeneratedAnswer({
            status: 'answered',
            answer: [
                'Nuh and Musa: Key Differences',
                'Nuh faced rejection from his people. [S1]',
                'Musa confronted Pharaoh. [S3]',
            ].join('\n\n'),
            citationIds: ['S1', 'S3'],
        }, COMPARISON_EVIDENCE, COMPARISON_OPTIONS), null);
    });

    it('does not over-require both entity branches for a one-sided comparison paragraph', () => {
        assert.equal(diagnoseGeneratedAnswer({
            status: 'answered',
            answer: 'Nuh remained with his people through prolonged rejection. [S2]',
            citationIds: ['S2'],
        }, COMPARISON_EVIDENCE, COMPARISON_OPTIONS), null);
    });

    it('rejects missing, wrong-entity, one-sided comparison, and third-entity citation support', () => {
        const cases = [
            { answer: 'Nuh faced rejection from his people.', citationIds: [] },
            { answer: 'Nuh faced rejection from his people. [S3]', citationIds: ['S3'] },
            { answer: 'Musa confronted Pharaoh. [S1]', citationIds: ['S1'] },
            { answer: 'Nuh and Musa faced different opponents. [S1]', citationIds: ['S1'] },
            { answer: 'Nuh faced rejection from his people. [S5]', citationIds: ['S5'] },
        ];
        for (const value of cases) {
            assert.notEqual(
                diagnoseGeneratedAnswer({ status: 'answered', ...value }, COMPARISON_EVIDENCE, COMPARISON_OPTIONS),
                null,
                value.answer,
            );
        }
    });

    it('rejects an empty answered comparison without weakening the ordinary single-entity contract', () => {
        assert.notEqual(diagnoseGeneratedAnswer({
            status: 'answered', answer: '', citationIds: [],
        }, COMPARISON_EVIDENCE, COMPARISON_OPTIONS), null);
        assert.equal(diagnoseGeneratedAnswer({
            status: 'answered', answer: 'Grounded ordinary answer. [S1]', citationIds: ['S1'],
        }, EVIDENCE), null);
    });

    it('applies distinct structural contracts to answered and typed insufficient outcomes', () => {
        const emptyAbstention = validateGeneratedAnswer({
            status: 'insufficient_evidence',
            abstentionReason: 'other_evidence_gap',
            answer: '',
            citationIds: [],
        }, EVIDENCE);
        assert.equal(emptyAbstention.status, 'insufficient_evidence');
        assert.equal(emptyAbstention.abstentionReason, 'other_evidence_gap');
        assert.equal(emptyAbstention.answer, '');
        assert.deepEqual(emptyAbstention.citationIds, []);

        const writtenAbstention = validateGeneratedAnswer({
            status: 'insufficient_evidence',
            abstentionReason: 'evidence_conflict',
            answer: 'I could not find enough reliable tafsir evidence to answer safely.',
            citationIds: [],
        }, EVIDENCE);
        assert.equal(writtenAbstention.status, 'insufficient_evidence');

        assert.throws(() => validateGeneratedAnswer({
            status: 'insufficient_evidence',
            answer: '',
            citationIds: [],
        }, EVIDENCE), /invalid generated answer/i);

        assert.throws(() => validateGeneratedAnswer({
            status: 'insufficient_evidence',
            abstentionReason: 'other_evidence_gap',
            answer: '',
            citationIds: ['S1'],
        }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({
            status: 'insufficient_evidence',
            abstentionReason: 'other_evidence_gap',
            answer: 'Bitcoin is performing best.',
            citationIds: [],
        }, EVIDENCE), /invalid generated answer/i);
        assert.throws(() => validateGeneratedAnswer({
            status: 'answered',
            answer: '',
            citationIds: ['S1'],
        }, EVIDENCE), /invalid generated answer/i);
    });
});
