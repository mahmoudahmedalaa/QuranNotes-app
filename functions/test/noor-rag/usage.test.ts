import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { NoorAnswer, NoorStatus } from '../../src/noor-rag/types';
import {
    DAILY_ANSWER_LIMITS,
    claimRequest,
    finalizeAnswered,
    finalizeNonAnswer,
    nextUtcResetIso,
    type UsageRepository,
    type UsageTransaction,
} from '../../src/noor-rag/usage';

const NOW_MS = Date.parse('2026-08-11T12:00:00.000Z');
const UID = 'firebase-user-1';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

class MemoryRepository implements UsageRepository {
    readonly documents = new Map<string, unknown>();
    private tail: Promise<void> = Promise.resolve();

    async runTransaction<T>(worker: (transaction: UsageTransaction) => Promise<T>): Promise<T> {
        let release: () => void = () => undefined;
        const previous = this.tail;
        this.tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        const staged = new Map<string, unknown>();
        try {
            const result = await worker({
                get: async (path) => this.documents.get(path) ?? null,
                set: (path, value) => { staged.set(path, structuredClone(value)); },
            });
            for (const [path, value] of staged) this.documents.set(path, value);
            return result;
        } finally {
            release();
        }
    }
}

function claim(
    repository: MemoryRepository,
    overrides: Partial<Parameters<typeof claimRequest>[0]> = {},
) {
    return claimRequest({
        repository,
        uid: UID,
        requestId: REQUEST_ID,
        invocationId: 'invocation-1',
        entitlementClass: 'paid',
        clock: () => new Date(NOW_MS),
        ...overrides,
    });
}

function answer(status: NoorStatus, requestId = REQUEST_ID): NoorAnswer {
    if (status === 'quota_exceeded') {
        return { requestId, answer: 'Limit reached', status, citations: [], nextResetAt: nextUtcResetIso(NOW_MS) };
    }
    return { requestId, answer: status === 'answered' ? 'Grounded answer' : 'Safe response', status, citations: [] };
}

describe('Noor transactional usage and idempotency', () => {
    it('exports the exact daily limits and computes the next UTC midnight', async () => {
        assert.equal(nextUtcResetIso(Date.parse('2026-08-11T23:59:59.999Z')), '2026-08-12T00:00:00.000Z');
        assert.deepEqual(DAILY_ANSWER_LIMITS, { paid: 50, grandfathered: 3, owner_qa: 100, none: 0 });
        assert.equal((await claim(new MemoryRepository(), { entitlementClass: 'none' })).kind, 'quota_exceeded');
    });

    it('atomically limits ten simultaneous distinct requests to five rolling-minute claims', async () => {
        const repository = new MemoryRepository();
        const results = await Promise.all(Array.from({ length: 10 }, (_, index) => claim(repository, {
            requestId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
            invocationId: `owner-${index}`,
        })));
        assert.equal(results.filter((result) => result.kind === 'claimed').length, 5);
        assert.equal(results.filter((result) => result.kind === 'rate_limited').length, 5);
    });

    it('gives one owner a same-request lease without double charging and reports other owners in progress', async () => {
        const repository = new MemoryRepository();
        const results = await Promise.all(Array.from({ length: 10 }, (_, index) => claim(repository, {
            invocationId: `owner-${index}`,
        })));
        assert.equal(results.filter((result) => result.kind === 'claimed').length, 1);
        assert.equal(results.filter((result) => result.kind === 'in_progress').length, 9);
        const claimed = results.find((result) => result.kind === 'claimed');
        assert.ok(claimed && claimed.kind === 'claimed');
        const sameOwner = await claim(repository, { invocationId: claimed.leaseOwnerId });
        assert.equal(sameOwner.kind, 'claimed');
        const rate = repository.documents.get(`noorRate/${UID}`) as { attemptsMs: number[] };
        const daily = repository.documents.get(`noorUsage/${UID}_2026-08-11`) as { reservations: unknown[] };
        assert.equal(rate.attemptsMs.length, 1);
        assert.equal(daily.reservations.length, 1);
    });

    it('recovers expired leases and purges expired reservations and rate attempts', async () => {
        const repository = new MemoryRepository();
        assert.equal((await claim(repository)).kind, 'claimed');
        const recovered = await claim(repository, {
            invocationId: 'invocation-2',
            clock: () => new Date(NOW_MS + 120_001),
        });
        assert.equal(recovered.kind, 'claimed');
        const rate = repository.documents.get(`noorRate/${UID}`) as { attemptsMs: number[] };
        const daily = repository.documents.get(`noorUsage/${UID}_2026-08-11`) as { reservations: Array<{ ownerId: string }> };
        assert.deepEqual(rate.attemptsMs, [NOW_MS + 120_001]);
        assert.deepEqual(daily.reservations.map((reservation) => reservation.ownerId), ['invocation-2']);
    });

    it('counts live reservations toward quota but purges expired reservations', async () => {
        const repository = new MemoryRepository();
        for (let index = 0; index < 3; index += 1) {
            assert.equal((await claim(repository, {
                entitlementClass: 'grandfathered',
                requestId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
                invocationId: `owner-${index}`,
            })).kind, 'claimed');
        }
        const blocked = await claim(repository, {
            entitlementClass: 'grandfathered',
            requestId: '00000000-0000-4000-8000-000000000099',
        });
        assert.equal(blocked.kind, 'quota_exceeded');
        const afterExpiry = await claim(repository, {
            entitlementClass: 'grandfathered',
            requestId: '00000000-0000-4000-8000-000000000100',
            clock: () => new Date(NOW_MS + 120_001),
        });
        assert.equal(afterExpiry.kind, 'claimed');
    });

    it('finalizes an answered request once and replays it for ten minutes without new charges', async () => {
        const repository = new MemoryRepository();
        assert.equal((await claim(repository)).kind, 'claimed');
        const response = answer('answered');
        assert.equal((await finalizeAnswered({
            repository, uid: UID, requestId: REQUEST_ID, invocationId: 'invocation-1', response,
            clock: () => new Date(NOW_MS + 1),
        })).kind, 'finalized');
        assert.equal((await finalizeAnswered({
            repository, uid: UID, requestId: REQUEST_ID, invocationId: 'invocation-1', response,
            clock: () => new Date(NOW_MS + 2),
        })).kind, 'already_finalized');
        const replay = await claim(repository, { invocationId: 'new-owner', clock: () => new Date(NOW_MS + 59_999) });
        assert.deepEqual(replay, { kind: 'replay', response });
        const rate = repository.documents.get(`noorRate/${UID}`) as { attemptsMs: number[] };
        const daily = repository.documents.get(`noorUsage/${UID}_2026-08-11`) as { answered: number; reservations: unknown[] };
        assert.equal(rate.attemptsMs.length, 1);
        assert.deepEqual({ answered: daily.answered, reservations: daily.reservations.length }, { answered: 1, reservations: 0 });
    });

    it('allows a new claim after completed replay expiry', async () => {
        const repository = new MemoryRepository();
        await claim(repository);
        await finalizeAnswered({ repository, uid: UID, requestId: REQUEST_ID, invocationId: 'invocation-1', response: answer('answered'), clock: () => new Date(NOW_MS + 1) });
        const result = await claim(repository, { invocationId: 'new-owner', clock: () => new Date(NOW_MS + 600_002) });
        assert.equal(result.kind, 'claimed');
    });

    it('releases daily capacity for every non-answer status while preserving the RPM attempt', async () => {
        const statuses: Exclude<NoorStatus, 'answered'>[] = [
            'insufficient_evidence', 'policy_refusal', 'not_entitled', 'quota_exceeded', 'invalid_request', 'temporarily_unavailable',
        ];
        for (const status of statuses) {
            const repository = new MemoryRepository();
            await claim(repository);
            await finalizeNonAnswer({ repository, uid: UID, requestId: REQUEST_ID, invocationId: 'invocation-1', response: answer(status), clock: () => new Date(NOW_MS + 1) });
            const daily = repository.documents.get(`noorUsage/${UID}_2026-08-11`) as { answered: number; reservations: unknown[] };
            const rate = repository.documents.get(`noorRate/${UID}`) as { attemptsMs: number[] };
            assert.deepEqual({ answered: daily.answered, reservations: daily.reservations.length, attempts: rate.attemptsMs.length }, { answered: 0, reservations: 0, attempts: 1 });
        }
    });

    it('rejects malformed stored state and wrong or stale lease finalization', async () => {
        const corrupt = new MemoryRepository();
        corrupt.documents.set(`noorRate/${UID}`, { attemptsMs: ['bad'], expiresAt: new Date(NOW_MS) });
        await assert.rejects(() => claim(corrupt), /Invalid Noor usage state/);

        const repository = new MemoryRepository();
        await claim(repository);
        await assert.rejects(() => finalizeAnswered({ repository, uid: UID, requestId: REQUEST_ID, invocationId: 'wrong', response: answer('answered'), clock: () => new Date(NOW_MS + 1) }), /lease/);
        await assert.rejects(() => finalizeAnswered({ repository, uid: UID, requestId: REQUEST_ID, invocationId: 'invocation-1', response: answer('answered'), clock: () => new Date(NOW_MS + 120_001) }), /lease/);
    });

    it('validates identifiers and persists only bounded operational fields and the completed response', async () => {
        for (const invalid of ['', 'slash/value', 'line\nbreak', 'x'.repeat(129)]) {
            await assert.rejects(() => claim(new MemoryRepository(), { uid: invalid }), /Invalid Noor identifier/);
        }
        const repository = new MemoryRepository();
        await claim(repository);
        await finalizeNonAnswer({ repository, uid: UID, requestId: REQUEST_ID, invocationId: 'invocation-1', response: answer('policy_refusal'), clock: () => new Date(NOW_MS + 1) });
        assert.deepEqual([...repository.documents.keys()].sort(), [
            `noorIdempotency/${UID}_${REQUEST_ID}`,
            `noorRate/${UID}`,
            `noorUsage/${UID}_2026-08-11`,
        ]);
        const serialized = JSON.stringify([...repository.documents.values()]);
        for (const forbidden of ['question', 'prompt', 'history', 'email', 'providerError', 'providerBody']) {
            assert.equal(serialized.includes(forbidden), false);
        }
    });
});
