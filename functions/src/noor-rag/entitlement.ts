const REVENUECAT_SUBSCRIBER_URL = 'https://api.revenuecat.com/v1/subscribers/';
const DEFAULT_TIMEOUT_MS = 3_000;
const MAX_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 5 * 60 * 1_000;
const MAX_FIREBASE_UID_LENGTH = 128;

export type EntitlementClass = 'paid' | 'grandfathered' | 'owner_qa' | 'none';

export interface EntitlementDecision {
    class: EntitlementClass;
    expiresAt: string | null;
    source: 'revenuecat' | 'cache' | 'server_record';
}

export class NoorEntitlementUnavailableError extends Error {
    readonly code = 'temporarily_unavailable' as const;

    constructor() {
        super('Noor entitlement is temporarily unavailable');
        this.name = 'NoorEntitlementUnavailableError';
    }
}

export interface EntitlementRepository {
    readDocument(path: string): Promise<unknown | null>;
    writeDocument(path: string, data: unknown): Promise<void>;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ResolveNoorEntitlementInput {
    firebaseUid: string;
    revenueCatSecret: string;
    repository: EntitlementRepository;
    fetcher: FetchLike;
    clock: () => Date;
    timeoutMs?: number;
}

interface NormalizedRevenueCatDecision {
    class: 'paid' | 'none';
    expiresAt: string | null;
}

interface CacheRecord extends NormalizedRevenueCatDecision {
    cachedAt: string;
    validUntil: string;
}

type ProviderResult =
    | { kind: 'decision'; decision: NormalizedRevenueCatDecision }
    | { kind: 'cache_eligible_failure' }
    | { kind: 'fail_closed' };

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseDate(value: unknown): Date | null {
    if (typeof value !== 'string') return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function validateFirebaseUid(firebaseUid: string): void {
    if (firebaseUid.length === 0
        || firebaseUid.length > MAX_FIREBASE_UID_LENGTH
        || firebaseUid.trim() !== firebaseUid
        || firebaseUid.includes('/')
        || /[\u0000-\u001f\u007f]/u.test(firebaseUid)) {
        throw new Error('Invalid Firebase UID');
    }
}

function isActiveServerRecord(value: unknown, now: Date): { expiresAt: string | null } | null {
    if (!isRecord(value) || value.active !== true) return null;
    if (value.expiresAt === null) return { expiresAt: null };
    const expiry = parseDate(value.expiresAt);
    if (expiry === null || expiry.getTime() <= now.getTime()) return null;
    return { expiresAt: expiry.toISOString() };
}

async function safeRead(repository: EntitlementRepository, path: string): Promise<unknown | null> {
    try {
        return await repository.readDocument(path);
    } catch {
        return null;
    }
}

function parseRevenueCatDecision(value: unknown, now: Date): NormalizedRevenueCatDecision | null {
    if (!isRecord(value) || !isRecord(value.subscriber) || !isRecord(value.subscriber.entitlements)) {
        return null;
    }
    const proAccess = value.subscriber.entitlements.pro_access;
    if (proAccess === undefined) return { class: 'none', expiresAt: null };
    if (!isRecord(proAccess)) return null;

    const expiresDateValue = proAccess.expires_date;
    if (expiresDateValue === null) return { class: 'paid', expiresAt: null };
    const expiry = parseDate(expiresDateValue);
    if (expiry === null) return null;

    const graceValue = proAccess.grace_period_expires_date;
    const grace = graceValue === null || graceValue === undefined ? null : parseDate(graceValue);
    if (graceValue !== null && graceValue !== undefined && grace === null) return null;

    const activeUntil = grace !== null && grace.getTime() > expiry.getTime() ? grace : expiry;
    if (activeUntil.getTime() <= now.getTime()) return { class: 'none', expiresAt: null };
    return { class: 'paid', expiresAt: activeUntil.toISOString() };
}

async function queryRevenueCat(input: ResolveNoorEntitlementInput, now: Date): Promise<ProviderResult> {
    const controller = new AbortController();
    const requestedTimeout = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timeoutMs = Math.max(1, Math.min(requestedTimeout, MAX_TIMEOUT_MS));
    let timeoutFired = false;
    const timeout = setTimeout(() => {
        timeoutFired = true;
        controller.abort();
    }, timeoutMs);
    try {
        const providerResponse = await input.fetcher(
            `${REVENUECAT_SUBSCRIBER_URL}${encodeURIComponent(input.firebaseUid)}`,
            {
                method: 'GET',
                headers: { Authorization: `Bearer ${input.revenueCatSecret}` },
                signal: controller.signal,
            },
        );
        if (providerResponse.status === 429 || providerResponse.status >= 500) {
            return { kind: 'cache_eligible_failure' };
        }
        if (!providerResponse.ok) return { kind: 'fail_closed' };
        let body: unknown;
        try {
            body = await providerResponse.json();
        } catch {
            return { kind: 'fail_closed' };
        }
        const decision = parseRevenueCatDecision(body, now);
        return decision === null ? { kind: 'fail_closed' } : { kind: 'decision', decision };
    } catch {
        return timeoutFired ? { kind: 'cache_eligible_failure' } : { kind: 'fail_closed' };
    } finally {
        clearTimeout(timeout);
    }
}

function parseFreshCache(value: unknown, now: Date): NormalizedRevenueCatDecision | null {
    if (!isRecord(value)
        || (value.class !== 'paid' && value.class !== 'none')
        || typeof value.cachedAt !== 'string'
        || typeof value.validUntil !== 'string') {
        return null;
    }
    const cachedAt = parseDate(value.cachedAt);
    const validUntil = parseDate(value.validUntil);
    if (cachedAt === null
        || validUntil === null
        || cachedAt.getTime() > now.getTime()
        || validUntil.getTime() <= now.getTime()
        || validUntil.getTime() > cachedAt.getTime() + CACHE_TTL_MS) {
        return null;
    }
    if (value.class === 'none') {
        return value.expiresAt === null ? { class: 'none', expiresAt: null } : null;
    }
    if (value.expiresAt === null) return { class: 'paid', expiresAt: null };
    const entitlementExpiry = parseDate(value.expiresAt);
    if (entitlementExpiry === null
        || entitlementExpiry.getTime() <= now.getTime()
        || validUntil.getTime() > entitlementExpiry.getTime()) {
        return null;
    }
    return { class: 'paid', expiresAt: entitlementExpiry.toISOString() };
}

async function safeWriteCache(
    repository: EntitlementRepository,
    path: string,
    decision: NormalizedRevenueCatDecision,
    now: Date,
): Promise<void> {
    const finiteExpiry = decision.expiresAt === null ? null : parseDate(decision.expiresAt);
    const validUntilMs = finiteExpiry === null
        ? now.getTime() + CACHE_TTL_MS
        : Math.min(now.getTime() + CACHE_TTL_MS, finiteExpiry.getTime());
    const record: CacheRecord = {
        ...decision,
        cachedAt: now.toISOString(),
        validUntil: new Date(validUntilMs).toISOString(),
    };
    try {
        await repository.writeDocument(path, record);
    } catch {
        // A cache optimization must never override a fresh provider decision.
    }
}

export async function resolveNoorEntitlement(
    input: ResolveNoorEntitlementInput,
): Promise<EntitlementDecision> {
    validateFirebaseUid(input.firebaseUid);
    const now = input.clock();
    if (!Number.isFinite(now.getTime())) throw new Error('Invalid clock');

    const ownerPath = `noorOwnerQa/${input.firebaseUid}`;
    const cachePath = `noorEntitlementCache/${input.firebaseUid}`;
    const grandfatheringPath = `noorGrandfathering/${input.firebaseUid}`;

    const owner = isActiveServerRecord(await safeRead(input.repository, ownerPath), now);
    if (owner !== null) return { class: 'owner_qa', expiresAt: owner.expiresAt, source: 'server_record' };

    const provider = await queryRevenueCat(input, now);
    let normalized: NormalizedRevenueCatDecision | null = null;
    let source: EntitlementDecision['source'] = 'revenuecat';
    if (provider.kind === 'decision') {
        normalized = provider.decision;
        await safeWriteCache(input.repository, cachePath, normalized, now);
    } else if (provider.kind === 'cache_eligible_failure') {
        normalized = parseFreshCache(await safeRead(input.repository, cachePath), now);
        if (normalized !== null) source = 'cache';
    }

    if (normalized?.class === 'paid') {
        return { class: 'paid', expiresAt: normalized.expiresAt, source };
    }

    const grandfathered = isActiveServerRecord(
        await safeRead(input.repository, grandfatheringPath),
        now,
    );
    if (grandfathered !== null) {
        return { class: 'grandfathered', expiresAt: grandfathered.expiresAt, source: 'server_record' };
    }
    if (normalized?.class === 'none') {
        return { class: 'none', expiresAt: null, source };
    }
    throw new NoorEntitlementUnavailableError();
}
