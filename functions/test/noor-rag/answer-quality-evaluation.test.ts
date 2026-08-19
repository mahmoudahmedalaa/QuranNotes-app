import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

interface QualityProperties {
    grounded: boolean;
    answersQuestion: boolean;
    preservesMaterialQualifications: boolean;
    materiallyMisleading: boolean;
    clear: boolean;
    citationConsistent: boolean;
}

interface AnswerQualityCase {
    id: string;
    question: string;
    selectedEvidence: readonly Readonly<{ promptSourceId: string; text: string }>[];
    generatedAnswer: string;
    citationIds: readonly string[];
    expected: Readonly<{ verdict: 'PASS' | 'FAIL'; properties: QualityProperties; sourceDerivedOracle: string }>;
}

interface AnswerQualityManifest {
    schemaVersion: 1;
    cases: readonly AnswerQualityCase[];
}

function manifest(): AnswerQualityManifest {
    return JSON.parse(readFileSync(resolve(
        __dirname,
        '../../../evals/noor-answer-quality-cases.json',
    ), 'utf8')) as AnswerQualityManifest;
}

describe('Noor answer-quality evaluation fixtures', () => {
    it('preserves the Wudu ambiguity as source-derived evaluation knowledge', () => {
        const wudu = manifest().cases.find(item => item.id === 'wudu-ambiguous-wording');

        assert.ok(wudu);
        assert.equal(wudu.question, 'Can you pray without wuduu?');
        assert.equal(
            wudu.generatedAnswer,
            'Wudu is obligatory in a state of impurity but merely recommended when already pure. [S1]',
        );
        assert.equal(wudu.expected.verdict, 'FAIL');
        assert.equal(wudu.expected.properties.grounded, true);
        assert.equal(wudu.expected.properties.materiallyMisleading, true);
        assert.match(wudu.expected.sourceDerivedOracle, /existing.*valid|still.*valid/i);
    });

    it('covers the complete generic answer-quality matrix', () => {
        const cases = manifest().cases;
        const expected = new Map([
            ['clearly-grounded-and-clear', 'PASS'],
            ['wudu-ambiguous-wording', 'FAIL'],
            ['night-prayer-qualification-omitted', 'FAIL'],
            ['unsupported-factual-claim', 'FAIL'],
            ['irrelevant-but-fluent', 'FAIL'],
            ['concise-complete-grounded', 'PASS'],
            ['citation-mismatch', 'FAIL'],
        ] as const);

        assert.equal(cases.length, expected.size);
        for (const [id, verdict] of expected) {
            assert.equal(cases.find(item => item.id === id)?.expected.verdict, verdict);
        }
    });

    it('uses the same property contract for Wudu and an unrelated qualification failure', () => {
        const cases = manifest().cases;
        const wudu = cases.find(item => item.id === 'wudu-ambiguous-wording');
        const unrelated = cases.find(item => item.id === 'night-prayer-qualification-omitted');

        assert.ok(wudu);
        assert.ok(unrelated);
        assert.deepEqual(Object.keys(wudu.expected.properties), Object.keys(unrelated.expected.properties));
        assert.equal(unrelated.expected.properties.grounded, true);
        assert.equal(unrelated.expected.properties.preservesMaterialQualifications, false);
        assert.equal(unrelated.expected.properties.materiallyMisleading, true);
        assert.doesNotMatch(unrelated.question, /wud|ablution|purification/i);
    });
});
