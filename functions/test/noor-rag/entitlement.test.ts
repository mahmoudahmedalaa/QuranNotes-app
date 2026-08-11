import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    resolveNoorEntitlement,
    type EntitlementRepository,
    type FetchLike,
} from '../../src/noor-rag/entitlement';

const NOW = new Date('2026-08-11T12:00:00.000Z');
const SECRET = 'rc-secret-test-value';
const UID = 'firebase+user@example.com';

class FakeRepository implements EntitlementRepository {
    readonly reads: string[] = [];
    readonly writes: { path: string; data: unknown }[] = [];

    constructor(
        private readonly documents: Readonly<Record<string, unknown>> = {},
        private readonly failReads = false,
        private readonly failWrites = false,
    ) {}

    async readDocument(path: string): Promise<unknown | null> {
        this.reads.push(path);
        if (this.failReads) throw new Error('private repository failure');
        return this.documents[path] ?? null;
    }

    async writeDocument(path: string, data: unknown): Promise<void> {
        this.writes.push({ path, data });
        if (this.failWrites) throw new Error('private cache write failure');
    }
}

function response(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function revenueCat(entitlement?: unknown): unknown {
    return { subscriber: { entitlements: entitlement === undefined ? {} : { pro_access: entitlement } } };
}

function active(expiresDate: string | null, gracePeriodExpiresDate: string | null = null): unknown {
    return {
        expires_date: expiresDate,
        grace_period_expires_date: gracePeriodExpiresDate,
        product_identifier: 'must-not-escape',
    };
}

function input(repository: EntitlementRepository, fetcher: FetchLike, timeoutMs = 20) {
    return {
        firebaseUid: UID,
        revenueCatSecret: SECRET,
        repository,
        fetcher,
        clock: () => new Date(NOW),
        timeoutMs,
    };
}

describe('Noor server entitlement resolution', () => {
    it('accepts active Monthly, Annual, Lifetime, and grace-period pro_access without product whitelists', async () => {
        const cases = [
            active('2026-09-11T12:00:00.000Z'),
            active('2027-08-11T12:00:00.000Z'),
            active(null),
            active('2026-08-10T12:00:00.000Z', '2026-08-12T12:00:00.000Z'),
        ];
        for (const entitlement of cases) {
            const result = await resolveNoorEntitlement(input(
                new FakeRepository(),
                async () => response(200, revenueCat(entitlement)),
            ));
            assert.equal(result.class, 'paid');
            assert.equal(result.source, 'revenuecat');
        }
    });

    it('returns none for expired, inactive, or missing pro_access', async () => {
        const cases = [
            active('2026-08-10T12:00:00.000Z'),
            active('2026-08-10T12:00:00.000Z', '2026-08-10T13:00:00.000Z'),
            undefined,
        ];
        for (const entitlement of cases) {
            const result = await resolveNoorEntitlement(input(
                new FakeRepository(),
                async () => response(200, revenueCat(entitlement)),
            ));
            assert.deepEqual(result, { class: 'none', expiresAt: null, source: 'revenuecat' });
        }
    });

    it('encodes the Firebase UID and sends the exact bearer header without exposing sensitive values', async () => {
        let capturedUrl = '';
        let capturedInit: RequestInit | undefined;
        const result = await resolveNoorEntitlement(input(new FakeRepository(), async (url, init) => {
            capturedUrl = url;
            capturedInit = init;
            return response(200, revenueCat(active(null)));
        }));

        assert.equal(capturedUrl, `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(UID)}`);
        assert.equal(new Headers(capturedInit?.headers).get('authorization'), `Bearer ${SECRET}`);
        assert.equal(capturedInit?.method, 'GET');
        assert.equal(JSON.stringify(result).includes(SECRET), false);
        assert.equal(JSON.stringify(result).includes('must-not-escape'), false);
    });

    it('rejects empty, oversized, slash-containing, and control-character UIDs before all I/O', async () => {
        for (const firebaseUid of ['', 'a'.repeat(129), 'user/path', 'user\nname']) {
            const repository = new FakeRepository();
            let fetched = false;
            await assert.rejects(() => resolveNoorEntitlement({
                ...input(repository, async () => {
                    fetched = true;
                    return response(200, revenueCat());
                }),
                firebaseUid,
            }), /^Error: Invalid Firebase UID$/);
            assert.equal(fetched, false);
            assert.deepEqual(repository.reads, []);
        }
    });

    it('uses fresh paid and none cache decisions on timeout, but rejects expired cache', async () => {
        for (const cachedClass of ['paid', 'none'] as const) {
            const repository = new FakeRepository({
                [`noorEntitlementCache/${UID}`]: {
                    class: cachedClass,
                    expiresAt: cachedClass === 'paid' ? '2026-08-12T12:00:00.000Z' : null,
                    cachedAt: '2026-08-11T12:00:00.000Z',
                    validUntil: '2026-08-11T12:04:59.000Z',
                },
            });
            const result = await resolveNoorEntitlement(input(repository, (_url, init) => new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(new Error('provider body secret')), { once: true });
            }), 2));
            assert.deepEqual(result, {
                class: cachedClass,
                expiresAt: cachedClass === 'paid' ? '2026-08-12T12:00:00.000Z' : null,
                source: 'cache',
            });
        }

        const expired = new FakeRepository({
            [`noorEntitlementCache/${UID}`]: {
                class: 'paid', expiresAt: null, cachedAt: '2026-08-11T11:54:59.000Z',
                validUntil: '2026-08-11T11:59:59.000Z',
            },
        });
        const result = await resolveNoorEntitlement(input(expired, async () => response(429, { secret: 'hidden' })));
        assert.deepEqual(result, { class: 'none', expiresAt: null, source: 'revenuecat' });
    });

    it('uses fresh cache for 429 and 5xx, but not for 401, 403, malformed provider data, or malformed cache', async () => {
        const freshCache = {
            [`noorEntitlementCache/${UID}`]: {
                class: 'paid', expiresAt: null, cachedAt: '2026-08-11T12:00:00.000Z',
                validUntil: '2026-08-11T12:05:00.000Z',
            },
        };
        for (const status of [429, 500, 503]) {
            const result = await resolveNoorEntitlement(input(
                new FakeRepository(freshCache), async () => response(status, { private: 'body' }),
            ));
            assert.deepEqual(result, { class: 'paid', expiresAt: null, source: 'cache' });
        }
        for (const status of [401, 403]) {
            const result = await resolveNoorEntitlement(input(
                new FakeRepository(freshCache), async () => response(status, { private: 'body' }),
            ));
            assert.deepEqual(result, { class: 'none', expiresAt: null, source: 'revenuecat' });
        }
        const malformedProvider = await resolveNoorEntitlement(input(
            new FakeRepository(freshCache), async () => response(200, { subscriber: { entitlements: [] } }),
        ));
        assert.deepEqual(malformedProvider, { class: 'none', expiresAt: null, source: 'revenuecat' });

        const malformedCache = await resolveNoorEntitlement(input(
            new FakeRepository({ [`noorEntitlementCache/${UID}`]: {
                class: 'paid', expiresAt: null, cachedAt: '2026-08-11T12:00:00.000Z', validUntil: 'not-a-date',
            } }),
            async () => response(500, {}),
        ));
        assert.deepEqual(malformedCache, { class: 'none', expiresAt: null, source: 'revenuecat' });
    });

    it('does not trust cache for non-timeout fetch failures or externally-originated aborts', async () => {
        const freshCache = {
            [`noorEntitlementCache/${UID}`]: {
                class: 'paid', expiresAt: null, cachedAt: '2026-08-11T12:00:00.000Z',
                validUntil: '2026-08-11T12:05:00.000Z',
            },
        };
        const failures = [
            new TypeError('DNS, TLS, or programming failure'),
            new DOMException('external abort', 'AbortError'),
        ];
        for (const failure of failures) {
            const repository = new FakeRepository(freshCache);
            const result = await resolveNoorEntitlement(input(repository, async () => {
                throw failure;
            }));
            assert.deepEqual(result, { class: 'none', expiresAt: null, source: 'revenuecat' });
            assert.equal(repository.reads.includes(`noorEntitlementCache/${UID}`), false);
        }
    });

    it('short-circuits active owner QA without RevenueCat and ignores inactive owner QA', async () => {
        let fetchCount = 0;
        const owner = await resolveNoorEntitlement(input(new FakeRepository({
            [`noorOwnerQa/${UID}`]: { active: true, expiresAt: '2026-08-12T12:00:00.000Z' },
        }), async () => {
            fetchCount += 1;
            return response(500, {});
        }));
        assert.deepEqual(owner, {
            class: 'owner_qa', expiresAt: '2026-08-12T12:00:00.000Z', source: 'server_record',
        });
        assert.equal(fetchCount, 0);

        const inactive = await resolveNoorEntitlement(input(new FakeRepository({
            [`noorOwnerQa/${UID}`]: { active: false, expiresAt: null },
        }), async () => {
            fetchCount += 1;
            return response(200, revenueCat());
        }));
        assert.equal(inactive.class, 'none');
        assert.equal(fetchCount, 1);
    });

    it('gives fresh RevenueCat paid precedence over grandfathering and otherwise falls back to active grandfathering', async () => {
        const documents = {
            [`noorGrandfathering/${UID}`]: { active: true, expiresAt: null },
        };
        const paid = await resolveNoorEntitlement(input(
            new FakeRepository(documents), async () => response(200, revenueCat(active(null))),
        ));
        assert.equal(paid.class, 'paid');

        const grandfathered = await resolveNoorEntitlement(input(
            new FakeRepository(documents), async () => response(500, { private: 'body' }),
        ));
        assert.deepEqual(grandfathered, { class: 'grandfathered', expiresAt: null, source: 'server_record' });

        const inactive = await resolveNoorEntitlement(input(new FakeRepository({
            [`noorGrandfathering/${UID}`]: { active: true, expiresAt: '2026-08-10T12:00:00.000Z' },
        }), async () => response(500, {})));
        assert.deepEqual(inactive, { class: 'none', expiresAt: null, source: 'revenuecat' });
    });

    it('fails safely on repository read failures and keeps freshly proven paid access on cache-write failure', async () => {
        const safe = await resolveNoorEntitlement(input(
            new FakeRepository({}, true), async () => response(500, { raw: 'hidden' }),
        ));
        assert.deepEqual(safe, { class: 'none', expiresAt: null, source: 'revenuecat' });

        const paid = await resolveNoorEntitlement(input(
            new FakeRepository({}, false, true), async () => response(200, revenueCat(active(null))),
        ));
        assert.deepEqual(paid, { class: 'paid', expiresAt: null, source: 'revenuecat' });
    });

    it('writes a normalized cache with five-minute TTL capped by finite entitlement expiry', async () => {
        const fiveMinutes = new FakeRepository();
        await resolveNoorEntitlement(input(fiveMinutes, async () => response(200, revenueCat(active(null)))));
        assert.deepEqual(fiveMinutes.writes, [{
            path: `noorEntitlementCache/${UID}`,
            data: {
                class: 'paid', expiresAt: null, cachedAt: '2026-08-11T12:00:00.000Z',
                validUntil: '2026-08-11T12:05:00.000Z',
            },
        }]);

        const capped = new FakeRepository();
        await resolveNoorEntitlement(input(capped, async () => response(
            200, revenueCat(active('2026-08-11T12:02:00.000Z')),
        )));
        assert.deepEqual(capped.writes[0], {
            path: `noorEntitlementCache/${UID}`,
            data: {
                class: 'paid',
                expiresAt: '2026-08-11T12:02:00.000Z',
                cachedAt: '2026-08-11T12:00:00.000Z',
                validUntil: '2026-08-11T12:02:00.000Z',
            },
        });
    });

    it('never reads the client-writable users access path', async () => {
        const repository = new FakeRepository({
            [`users/${UID}/access`]: { active: true },
        });
        await resolveNoorEntitlement(input(repository, async () => response(500, {})));
        assert.deepEqual(repository.reads, [
            `noorOwnerQa/${UID}`,
            `noorEntitlementCache/${UID}`,
            `noorGrandfathering/${UID}`,
        ]);
        assert.equal(repository.reads.some(path => path.startsWith('users/')), false);
    });
});
