import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as verifyLiveModule from '../../scripts/noor-rag/verify-live';

interface PacerOptions {
    intervalMs?: number;
    nowMs(): number;
    sleep(milliseconds: number): Promise<void>;
}

type PacerFactory = (options: PacerOptions) => () => Promise<void>;

interface EvidenceExpectation {
    source: string;
    canonicalUnitId: string;
    chunkIds: readonly string[];
}

interface CitationEvidence {
    source: string;
    canonicalUnitId: string;
    chunkId: string;
}

type CitationEvidenceValidator = (
    goldenCase: { exact?: unknown; expectedEvidence: readonly EvidenceExpectation[] },
    citations: readonly CitationEvidence[],
) => boolean;

type TransportErrorClassifier = (error: unknown) => string;
type HistoryAnswerBounder = (answer: string) => string;

describe('Noor authenticated live verifier', () => {
    it('paces requests to respect the production rolling-minute limit', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.createLiveRequestPacer, 'function');
        const createPacer = module.createLiveRequestPacer as PacerFactory;
        let now = 1_000;
        const sleeps: number[] = [];
        const pace = createPacer({
            nowMs: () => now,
            sleep: async milliseconds => {
                sleeps.push(milliseconds);
                now += milliseconds;
            },
        });

        await pace();
        now += 3_000;
        await pace();
        now += 13_000;
        await pace();

        assert.deepEqual(sleeps, [12_000, 2_000]);
    });

    it('accepts one grounded golden evidence group for semantic chat but keeps exact lookup strict', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.expectedCitationEvidenceSatisfied, 'function');
        const validate = module.expectedCitationEvidenceSatisfied as CitationEvidenceValidator;
        const expectedEvidence = [
            { source: 'ibn_kathir_en_abridged', canonicalUnitId: 'unit-riba', chunkIds: ['chunk-1', 'chunk-2'] },
            { source: 'al_sadi_ar', canonicalUnitId: 'unit-riba-ar', chunkIds: ['chunk-ar'] },
        ];
        const citations = [
            { source: 'ibn_kathir_en_abridged', canonicalUnitId: 'unit-riba', chunkId: 'chunk-1' },
        ];

        assert.equal(validate({ expectedEvidence }, citations), true);
        assert.equal(validate({ expectedEvidence }, [{ ...citations[0]!, canonicalUnitId: 'wrong-unit' }]), false);
        assert.equal(validate({ exact: {}, expectedEvidence }, citations), false);
    });

    it('preserves only allowlisted transport diagnostics', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.classifyLiveTransportError, 'function');
        const classify = module.classifyLiveTransportError as TransportErrorClassifier;

        assert.equal(classify(new Error('request_id_mismatch')), 'request_id_mismatch');
        assert.equal(classify(new Error('temporarily_unavailable')), 'temporarily_unavailable');
        assert.equal(classify(new Error('provider response contained secret details')), 'network_error');
        assert.equal(classify('not-an-error'), 'network_error');
    });

    it('bounds replayed assistant history to the production per-turn contract', () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.boundedLiveHistoryAnswer, 'function');
        const bound = module.boundedLiveHistoryAnswer as HistoryAnswerBounder;
        const result = bound('😀'.repeat(1_001));

        assert.equal([...result].length, 1_000);
        assert.equal(result, '😀'.repeat(1_000));
    });
});
