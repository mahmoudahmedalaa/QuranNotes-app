import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL,
    createVertexEmbedder,
    embedWithConcurrency,
    formatEmbeddingDocument,
    formatEmbeddingQuery,
    validateEmbedding,
    type Embedder,
} from '../../src/noor-rag/embedding';

describe('Noor corpus embeddings', () => {
    it('locks the production model and output dimension', () => {
        assert.equal(EMBEDDING_MODEL, 'gemini-embedding-2');
        assert.equal(EMBEDDING_DIMENSION, 768);
    });

    it('formats asymmetric document and query inputs exactly', () => {
        assert.equal(
            formatEmbeddingDocument("Tafsir Al-Sa'di", 'Commentary text.'),
            "title: Tafsir Al-Sa'di | text: Commentary text.",
        );
        assert.equal(
            formatEmbeddingQuery('What does this verse teach?'),
            'task: question answering | domain: Quran tafsir | query: What does this verse teach?',
        );
    });

    it('builds the Gemini Embedding 2 request without a legacy task type', async () => {
        let captured: unknown;
        const embedder = createVertexEmbedder({
            embedContent: async (request) => {
                captured = request;
                return { embeddings: [{ values: Array<number>(768).fill(0.5) }] };
            },
        });
        const document = formatEmbeddingDocument('Tafsir Ibn Kathir', 'Exact retrieval text');

        await embedder.embed(document);

        assert.deepEqual(captured, {
            model: 'gemini-embedding-2',
            contents: 'title: Tafsir Ibn Kathir | text: Exact retrieval text',
            config: { outputDimensionality: 768, autoTruncate: false },
        });
        const config = (captured as { config: Record<string, unknown> }).config;
        assert.equal(Object.prototype.hasOwnProperty.call(config, 'taskType'), false);
    });

    it('rejects empty, wrong-length, NaN, and infinite vectors', () => {
        assert.throws(() => validateEmbedding([]), /768/);
        assert.throws(() => validateEmbedding([1]), /768/);
        assert.throws(() => validateEmbedding([...Array<number>(767).fill(0), Number.NaN]), /finite/);
        assert.throws(() => validateEmbedding([...Array<number>(767).fill(0), Number.POSITIVE_INFINITY]), /finite/);
    });

    it('preserves deterministic order while bounding concurrency at thirty-two', async () => {
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

        const texts = Array.from({ length: 40 }, (_, index) => String(index));
        const results = await embedWithConcurrency(texts, embedder);

        assert.equal(maximumActive, 32);
        assert.deepEqual(results.map(result => result.ok ? result.embedding[0] : 'failed'), texts.map(Number));
    });
});
