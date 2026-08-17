import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import * as verifyLiveModule from '../../scripts/noor-rag/verify-live';

interface PacerOptions {
    intervalMs: number;
    nowMs(): number;
    sleep(milliseconds: number): Promise<void>;
}

type PacerFactory = (options: PacerOptions) => () => Promise<void>;

describe('Noor authenticated live verifier', () => {
    it('paces requests to respect the production rolling-minute limit', async () => {
        const module = verifyLiveModule as unknown as Record<string, unknown>;
        assert.equal(typeof module.createLiveRequestPacer, 'function');
        const createPacer = module.createLiveRequestPacer as PacerFactory;
        let now = 1_000;
        const sleeps: number[] = [];
        const pace = createPacer({
            intervalMs: 12_000,
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

        assert.deepEqual(sleeps, [9_000]);
    });
});
