import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL,
    embedWithConcurrency,
    validateEmbedding,
    type Embedder,
} from '../../src/noor-rag/embedding';

describe('Noor corpus embeddings', () => {
    it('locks the production model and output dimension', () => {
        assert.equal(EMBEDDING_MODEL, 'gemini-embedding-001');
        assert.equal(EMBEDDING_DIMENSION, 768);
    });

    it('rejects empty, wrong-length, NaN, and infinite vectors', () => {
        assert.throws(() => validateEmbedding([]), /768/);
        assert.throws(() => validateEmbedding([1]), /768/);
        assert.throws(() => validateEmbedding([...Array<number>(767).fill(0), Number.NaN]), /finite/);
        assert.throws(() => validateEmbedding([...Array<number>(767).fill(0), Number.POSITIVE_INFINITY]), /finite/);
    });

    it('preserves deterministic order while bounding concurrency at four', async () => {
        let active = 0;
        let maximumActive = 0;
        const embedder: Embedder = {
            embed: async (text: string): Promise<readonly number[]> => {
                active += 1;
                maximumActive = Math.max(maximumActive, active);
                await new Promise(resolve => setTimeout(resolve, text === '0' ? 12 : 1));
                active -= 1;
                return Array<number>(EMBEDDING_DIMENSION).fill(Number(text));
            },
        };

        const results = await embedWithConcurrency(['0', '1', '2', '3', '4', '5'], embedder);

        assert.equal(maximumActive, 4);
        assert.deepEqual(results.map(result => result.ok ? result.embedding[0] : 'failed'), [0, 1, 2, 3, 4, 5]);
    });
});
