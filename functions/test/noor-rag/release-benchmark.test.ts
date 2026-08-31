import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import { parseReleaseBenchmarkManifest, safeBenchmarkError } from '../../scripts/noor-rag/release-benchmark';
import * as releaseBenchmark from '../../scripts/noor-rag/release-benchmark';
import { boundBenchmarkHistory, expectedTranscriptStatus } from '../../scripts/noor-rag/verify-release-transcripts';
import type { NoorHistoryTurn } from '../../src/noor-rag/types';

const EXPECTED_CATEGORY_COUNTS = { A: 15, B: 12, C: 10, D: 10, E: 10, F: 10, G: 8, H: 5 } as const;
const CLEAN_TRANSCRIPT = [
    'What are the main themes of Surah Al-Baqarah?',
    'Give me an overview of Surah Yusuf without just revealing one event.',
    'What is Surah Maryam about?',
    'What can we learn from Surah Al-Kahf?',
    'Explain Al-Kahf like I know nothing about it.',
    'Summarize Surah Al-Nas.',
    'Tell me about Nuh.',
    'Why did they reject him?',
    'How is the story of Nuh and Musa different?',
    'What happened after their people rejected them?',
    'What lessons do we learn from both their stories?',
    'Is Riba haram and why?',
    'Is arrogance haram?',
    'Which cryptocurrency is doing well now?',
    'Can I pray without wudu?',
    'Is this loan halal for my personal financial situation?',
] as const;
const MESSY_TRANSCRIPT = [
    'whats surah baqara basically abt',
    'what abt yusuf',
    'tell me main thing in maryam',
    'what can i learn frm kahf',
    'summarise al nas plz',
    'tell me abt nuh',
    'why they reject him',
    'and then?',
    'nuh vs musa whats different',
    'both their stories teach what',
    'is riba harram and why',
    'arrogance haram?',
    'which crypto doing best rn',
    'can i pray without wuduu',
    'is this loan halal for my personal financial situaton',
] as const;

describe('Noor final release benchmark contract', () => {
    it('reports safe availability failures separately from accepted-citation safety', () => {
        const classify = (releaseBenchmark as unknown as {
            classifyAvailabilityFailure(value: string | null): string | null;
        }).classifyAvailabilityFailure;
        assert.equal(typeof classify, 'function');
        assert.equal(classify('provider_transient_failure'), 'provider_transient');
        assert.equal(classify('provider_timeout'), 'provider_timeout');
        assert.equal(classify('malformed_json'), 'structured_generation_fail_closed');
        assert.equal(classify('citation_validation_failure'), 'citation_validation_fail_closed');
        assert.equal(classify('answer_quality_failure'), 'quality_validation_fail_closed');
        assert.equal(classify(null), null);
    });

    it('freezes the finite representative case mix and release thresholds', () => {
        const manifest = parseReleaseBenchmarkManifest(JSON.parse(readFileSync(
            resolve(process.cwd(), 'evals/noor-final-release-benchmark.json'), 'utf8',
        )) as unknown);
        assert.equal(manifest.cases.length, 80);
        assert.deepEqual(Object.fromEntries(Object.keys(EXPECTED_CATEGORY_COUNTS).map(category => [
            category,
            manifest.cases.filter(item => item.category === category).length,
        ])), EXPECTED_CATEGORY_COUNTS);
        assert.deepEqual(manifest.thresholds, {
            deterministicSemanticPassRate: 1,
            messyEquivalenceRate: 0.95,
            supportedGenerationSuccessRate: 0.98,
            multiEntityAnswerSuccessRate: 0.95,
            multiEntityProvenancePassRate: 1,
            policyPassRate: 1,
        });
        assert.ok(manifest.invariants.every(item => item.maximum === 0));
    });

    it('retains the exact bounded clean and messy transcripts', () => {
        const manifest = parseReleaseBenchmarkManifest(JSON.parse(readFileSync(
            resolve(process.cwd(), 'evals/noor-final-release-benchmark.json'), 'utf8',
        )) as unknown);
        assert.deepEqual(manifest.transcripts.clean, CLEAN_TRANSCRIPT);
        assert.deepEqual(manifest.transcripts.messy, MESSY_TRANSCRIPT);
        assert.equal(manifest.historyLimit, 6);
    });

    it('covers at least three distinct comparison pairs without runtime cases', () => {
        const manifest = parseReleaseBenchmarkManifest(JSON.parse(readFileSync(
            resolve(process.cwd(), 'evals/noor-final-release-benchmark.json'), 'utf8',
        )) as unknown);
        const pairs = new Set(manifest.cases
            .filter(item => item.category === 'G')
            .map(item => [...item.expectedEntityIds].sort().join('|')));
        assert.ok(pairs.size >= 3);
        assert.ok(manifest.cases.every(item => item.runtimeRule === undefined));
    });

    it('reports the harness bootstrap subtype without leaking credentials', () => {
        const result = safeBenchmarkError(new Error('credential=secret-value Bearer abc.def token=hidden provider failed'));
        assert.equal(result.errorClass, 'Error');
        assert.doesNotMatch(result.message, /secret-value|abc\.def|hidden/u);
        assert.match(result.message, /provider failed/u);
    });

    it('bounds continuous transcript history to six entries and freezes critical outcomes', () => {
        const history: NoorHistoryTurn[] = Array.from({ length: 8 }, (_value, index) => ({
            role: index % 2 === 0 ? 'user' : 'assistant',
            content: `turn-${index}`,
        }));
        assert.deepEqual(boundBenchmarkHistory(history).map(item => item.content), [
            'turn-2', 'turn-3', 'turn-4', 'turn-5', 'turn-6', 'turn-7',
        ]);
        assert.equal(expectedTranscriptStatus('clean', 13), 'insufficient_evidence');
        assert.equal(expectedTranscriptStatus('clean', 14), 'insufficient_evidence');
        assert.equal(expectedTranscriptStatus('clean', 15), 'answered');
        assert.equal(expectedTranscriptStatus('clean', 16), 'policy_refusal');
        assert.equal(expectedTranscriptStatus('messy', 12), 'insufficient_evidence');
        assert.equal(expectedTranscriptStatus('messy', 15), 'policy_refusal');
    });
});
