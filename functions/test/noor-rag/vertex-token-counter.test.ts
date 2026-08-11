import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    createVertexBatchTokenCounter,
    type VertexComputeTokensClient,
    type VertexComputeTokensRequest,
} from '../../src/noor-rag/vertex-token-counter';

function tokenInfo(length: number): { tokenIds: string[] } {
    return { tokenIds: Array.from({ length }, (_, index) => String(index)) };
}

describe('Vertex batch token counter', () => {
    it('coalesces independent texts and maps exact counts back in request order', async () => {
        const requests: VertexComputeTokensRequest[] = [];
        const client: VertexComputeTokensClient = { models: {
            computeTokens: async request => {
                requests.push(request);
                return { tokensInfo: request.contents.map((_, index) => tokenInfo(index + 2)) };
            },
        } };
        const counter = createVertexBatchTokenCounter(client, 'model', {
            batchSize: 4,
            concurrency: 1,
            timeoutMs: 100,
        });

        const counts = await Promise.all([
            counter.countTokens('first'),
            counter.countTokens('second'),
            counter.countTokens('third'),
        ]);

        assert.deepEqual(counts, [2, 3, 4]);
        assert.equal(requests.length, 1);
        assert.deepEqual(requests[0]!.contents.map(content => content.parts[0]!.text), [
            'first', 'second', 'third',
        ]);
    });

    it('bounds batch cardinality and in-flight request concurrency', async () => {
        let active = 0;
        let maximumActive = 0;
        const batchSizes: number[] = [];
        const releases: Array<() => void> = [];
        const client: VertexComputeTokensClient = { models: {
            computeTokens: async request => {
                active += 1;
                maximumActive = Math.max(maximumActive, active);
                batchSizes.push(request.contents.length);
                await new Promise<void>(resolve => releases.push(resolve));
                active -= 1;
                return { tokensInfo: request.contents.map(() => tokenInfo(1)) };
            },
        } };
        const counter = createVertexBatchTokenCounter(client, 'model', {
            batchSize: 2,
            concurrency: 2,
            timeoutMs: 1_000,
        });
        const pending = ['a', 'b', 'c', 'd', 'e'].map(text => counter.countTokens(text));
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(maximumActive, 2);
        assert.deepEqual(batchSizes, [2, 2]);
        releases.splice(0).forEach(release => release());
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(batchSizes, [2, 2, 1]);
        releases.splice(0).forEach(release => release());
        assert.deepEqual(await Promise.all(pending), [1, 1, 1, 1, 1]);
    });

    it('rejects the whole batch when Vertex response cardinality or counts are malformed', async () => {
        for (const response of [
            { tokensInfo: [tokenInfo(1)] },
            { tokensInfo: [{ tokenIds: undefined }] },
        ]) {
            const counter = createVertexBatchTokenCounter({ models: {
                computeTokens: async () => response,
            } }, 'model', { batchSize: 4, concurrency: 1, timeoutMs: 100 });
            const results = await Promise.allSettled([
                counter.countTokens('a'),
                counter.countTokens('b'),
            ]);
            assert.ok(results.every(result => result.status === 'rejected'));
        }
    });

    it('retries only transient 429 and 5xx failures, at most twice', async () => {
        let transientAttempts = 0;
        const transientCounter = createVertexBatchTokenCounter({ models: {
            computeTokens: async request => {
                transientAttempts += 1;
                if (transientAttempts < 3) {
                    throw Object.assign(new Error('busy'), { status: transientAttempts === 1 ? 429 : 503 });
                }
                return { tokensInfo: request.contents.map(() => tokenInfo(1)) };
            },
        } }, 'model', { batchSize: 1, concurrency: 1, timeoutMs: 100, retryDelayMs: 0 });
        assert.equal(await transientCounter.countTokens('a'), 1);
        assert.equal(transientAttempts, 3);

        let permanentAttempts = 0;
        const permanentCounter = createVertexBatchTokenCounter({ models: {
            computeTokens: async () => {
                permanentAttempts += 1;
                throw Object.assign(new Error('bad request'), { status: 400 });
            },
        } }, 'model', { batchSize: 1, concurrency: 1, timeoutMs: 100, retryDelayMs: 0 });
        await assert.rejects(permanentCounter.countTokens('a'), /bad request/);
        assert.equal(permanentAttempts, 1);

        let exhaustedAttempts = 0;
        const exhaustedCounter = createVertexBatchTokenCounter({ models: {
            computeTokens: async () => {
                exhaustedAttempts += 1;
                throw Object.assign(new Error('still busy'), { status: 503 });
            },
        } }, 'model', { batchSize: 1, concurrency: 1, timeoutMs: 100, retryDelayMs: 0 });
        await assert.rejects(exhaustedCounter.countTokens('a'), /still busy/);
        assert.equal(exhaustedAttempts, 3);
    });

    it('times out a stalled request without retrying it', async () => {
        let attempts = 0;
        const counter = createVertexBatchTokenCounter({ models: {
            computeTokens: async () => {
                attempts += 1;
                return new Promise(() => undefined);
            },
        } }, 'model', { batchSize: 1, concurrency: 1, timeoutMs: 10, retryDelayMs: 0 });

        await assert.rejects(counter.countTokens('a'), /timed out/i);
        assert.equal(attempts, 1);
    });
});
