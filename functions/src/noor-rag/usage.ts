import type { NoorAnswer, NoorStatus } from './types';
import { parseNoorAnswer } from './validation';

export type NoorEntitlementClass = 'paid' | 'grandfathered' | 'owner_qa' | 'none';

export const DAILY_ANSWER_LIMITS: Readonly<Record<NoorEntitlementClass, number>> = Object.freeze({
    paid: 50,
    grandfathered: 3,
    owner_qa: 100,
    none: 0,
});

export const RATE_LIMIT_ATTEMPTS = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const LEASE_DURATION_MS = 120_000;
export const COMPLETED_REPLAY_MS = 600_000;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_IDENTIFIER_PATTERN = /^[^/\u0000-\u001f\u007f]{1,128}$/;

export interface UsageTransaction {
    get(path: string): Promise<unknown | null>;
    set(path: string, value: unknown): void;
}

export interface UsageRepository {
    runTransaction<T>(worker: (transaction: UsageTransaction) => Promise<T>): Promise<T>;
}

export type ClaimResult =
    | { kind: 'claimed'; leaseOwnerId: string; leaseExpiresAt: string }
    | { kind: 'replay'; response: NoorAnswer }
    | { kind: 'rate_limited'; retryAt: string }
    | { kind: 'quota_exceeded'; nextResetAt: string }
    | { kind: 'in_progress'; retryAt: string };

export type FinalizeResult = { kind: 'finalized' } | { kind: 'already_finalized' };

interface ClaimInput {
    repository: UsageRepository;
    uid: string;
    requestId: string;
    invocationId: string;
    entitlementClass: NoorEntitlementClass;
    clock?: () => Date;
}

interface FinalizeInput {
    repository: UsageRepository;
    uid: string;
    requestId: string;
    invocationId: string;
    response: NoorAnswer;
    clock?: () => Date;
}

interface Reservation {
    requestId: string;
    ownerId: string;
    expiresAtMs: number;
}

interface DailyState {
    dateUtc: string;
    answered: number;
    reservations: Reservation[];
    expiresAt: Date;
}

interface RateState {
    attemptsMs: number[];
    expiresAt: Date;
}

interface PendingState {
    status: 'pending';
    ownerId: string;
    usageDateUtc: string;
    leaseExpiresAtMs: number;
    expiresAt: Date;
}

interface CompletedState {
    status: 'completed';
    finalizedBy: string;
    response: NoorAnswer;
    responseExpiresAtMs: number;
    expiresAt: Date;
}

type IdempotencyState = PendingState | CompletedState;

function invalidState(): never {
    throw new Error('Invalid Noor usage state');
}

function invalidLease(): never {
    throw new Error('Invalid or expired Noor lease');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
    const actual = Reflect.ownKeys(value);
    return actual.length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function asDate(value: unknown): Date {
    if (value instanceof Date && Number.isFinite(value.getTime())) return new Date(value.getTime());
    if (isRecord(value) && typeof value.toMillis === 'function') {
        const millis = (value.toMillis as () => unknown)();
        if (typeof millis === 'number' && Number.isFinite(millis)) return new Date(millis);
    }
    return invalidState();
}

function parseIdentifier(value: string, uuidOnly = false): string {
    if (!SAFE_IDENTIFIER_PATTERN.test(value) || (uuidOnly && !UUID_PATTERN.test(value))) {
        throw new Error('Invalid Noor identifier');
    }
    return value;
}

function nowFrom(clock: (() => Date) | undefined): Date {
    const now = (clock ?? (() => new Date()))();
    if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error('Invalid Noor clock');
    return new Date(now.getTime());
}

function utcDate(nowMs: number): string {
    return new Date(nowMs).toISOString().slice(0, 10);
}

export function nextUtcResetIso(nowMs: number): string {
    if (!Number.isFinite(nowMs)) throw new Error('Invalid Noor clock');
    const now = new Date(nowMs);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
}

function parseReservation(value: unknown): Reservation {
    if (!isRecord(value)
        || !hasExactKeys(value, ['requestId', 'ownerId', 'expiresAtMs'])
        || typeof value.requestId !== 'string'
        || typeof value.ownerId !== 'string'
        || typeof value.expiresAtMs !== 'number'
        || !Number.isSafeInteger(value.expiresAtMs)) return invalidState();
    try {
        parseIdentifier(value.requestId, true);
        parseIdentifier(value.ownerId);
    } catch {
        return invalidState();
    }
    return { requestId: value.requestId, ownerId: value.ownerId, expiresAtMs: value.expiresAtMs };
}

function parseDaily(value: unknown, expectedDate: string, resetAt: Date): DailyState {
    if (value === null) return { dateUtc: expectedDate, answered: 0, reservations: [], expiresAt: resetAt };
    if (!isRecord(value)
        || !hasExactKeys(value, ['dateUtc', 'answered', 'reservations', 'expiresAt'])
        || value.dateUtc !== expectedDate
        || typeof value.answered !== 'number'
        || !Number.isSafeInteger(value.answered)
        || value.answered < 0
        || value.answered > DAILY_ANSWER_LIMITS.owner_qa
        || !Array.isArray(value.reservations)
        || value.reservations.length > DAILY_ANSWER_LIMITS.owner_qa) return invalidState();
    const expiresAt = asDate(value.expiresAt);
    if (expiresAt.getTime() !== resetAt.getTime()) return invalidState();
    return {
        dateUtc: expectedDate,
        answered: value.answered,
        reservations: value.reservations.map(parseReservation),
        expiresAt,
    };
}

function parseRate(value: unknown, defaultExpiry: Date): RateState {
    if (value === null) return { attemptsMs: [], expiresAt: defaultExpiry };
    if (!isRecord(value)
        || !hasExactKeys(value, ['attemptsMs', 'expiresAt'])
        || !Array.isArray(value.attemptsMs)
        || value.attemptsMs.length > RATE_LIMIT_ATTEMPTS
        || !value.attemptsMs.every((attempt) => typeof attempt === 'number' && Number.isSafeInteger(attempt))) return invalidState();
    const attemptsMs = [...value.attemptsMs] as number[];
    for (let index = 1; index < attemptsMs.length; index += 1) {
        if ((attemptsMs[index - 1] ?? 0) > (attemptsMs[index] ?? 0)) return invalidState();
    }
    return { attemptsMs, expiresAt: asDate(value.expiresAt) };
}

function parseIdempotency(value: unknown): IdempotencyState | null {
    if (value === null) return null;
    if (!isRecord(value) || typeof value.status !== 'string') return invalidState();
    if (value.status === 'pending') {
        if (!hasExactKeys(value, ['status', 'ownerId', 'usageDateUtc', 'leaseExpiresAtMs', 'expiresAt'])
            || typeof value.ownerId !== 'string'
            || typeof value.usageDateUtc !== 'string'
            || !/^\d{4}-\d{2}-\d{2}$/.test(value.usageDateUtc)
            || typeof value.leaseExpiresAtMs !== 'number'
            || !Number.isSafeInteger(value.leaseExpiresAtMs)) return invalidState();
        try { parseIdentifier(value.ownerId); } catch { return invalidState(); }
        if (asDate(value.expiresAt).getTime() !== value.leaseExpiresAtMs) return invalidState();
        return {
            status: 'pending', ownerId: value.ownerId, usageDateUtc: value.usageDateUtc,
            leaseExpiresAtMs: value.leaseExpiresAtMs, expiresAt: new Date(value.leaseExpiresAtMs),
        };
    }
    if (value.status === 'completed') {
        if (!hasExactKeys(value, ['status', 'finalizedBy', 'response', 'responseExpiresAtMs', 'expiresAt'])
            || typeof value.finalizedBy !== 'string'
            || typeof value.responseExpiresAtMs !== 'number'
            || !Number.isSafeInteger(value.responseExpiresAtMs)) return invalidState();
        try { parseIdentifier(value.finalizedBy); } catch { return invalidState(); }
        if (asDate(value.expiresAt).getTime() !== value.responseExpiresAtMs) return invalidState();
        let response: NoorAnswer;
        try { response = parseNoorAnswer(value.response); } catch { return invalidState(); }
        return {
            status: 'completed', finalizedBy: value.finalizedBy, response,
            responseExpiresAtMs: value.responseExpiresAtMs, expiresAt: new Date(value.responseExpiresAtMs),
        };
    }
    return invalidState();
}

function paths(uid: string, requestId: string, dateUtc: string): { daily: string; rate: string; idempotency: string } {
    return {
        daily: `noorUsage/${uid}_${dateUtc}`,
        rate: `noorRate/${uid}`,
        idempotency: `noorIdempotency/${uid}_${requestId}`,
    };
}

export async function claimRequest(input: ClaimInput): Promise<ClaimResult> {
    const uid = parseIdentifier(input.uid);
    const requestId = parseIdentifier(input.requestId, true);
    const invocationId = parseIdentifier(input.invocationId);
    if (!Object.prototype.hasOwnProperty.call(DAILY_ANSWER_LIMITS, input.entitlementClass)) {
        throw new Error('Invalid Noor entitlement class');
    }
    const now = nowFrom(input.clock);
    const nowMs = now.getTime();
    const dateUtc = utcDate(nowMs);
    const resetAt = new Date(nextUtcResetIso(nowMs));
    const documentPaths = paths(uid, requestId, dateUtc);

    return input.repository.runTransaction(async (transaction): Promise<ClaimResult> => {
        const [dailyValue, rateValue, idempotencyValue] = await Promise.all([
            transaction.get(documentPaths.daily),
            transaction.get(documentPaths.rate),
            transaction.get(documentPaths.idempotency),
        ]);
        const daily = parseDaily(dailyValue, dateUtc, resetAt);
        const rate = parseRate(rateValue, new Date(nowMs + RATE_LIMIT_WINDOW_MS));
        const idempotency = parseIdempotency(idempotencyValue);
        const reservations = daily.reservations.filter((reservation) => reservation.expiresAtMs > nowMs);
        const attemptsMs = rate.attemptsMs.filter((attempt) => attempt > nowMs - RATE_LIMIT_WINDOW_MS);
        const persistPruning = (): void => {
            if (reservations.length !== daily.reservations.length) {
                transaction.set(documentPaths.daily, { ...daily, reservations, expiresAt: resetAt } satisfies DailyState);
            }
            if (attemptsMs.length !== rate.attemptsMs.length) {
                const expiryMs = attemptsMs[0] === undefined ? nowMs : attemptsMs[0] + RATE_LIMIT_WINDOW_MS;
                transaction.set(documentPaths.rate, { attemptsMs, expiresAt: new Date(expiryMs) } satisfies RateState);
            }
        };

        if (idempotency?.status === 'completed' && idempotency.responseExpiresAtMs > nowMs) {
            persistPruning();
            return { kind: 'replay', response: idempotency.response };
        }
        if (idempotency?.status === 'pending' && idempotency.leaseExpiresAtMs > nowMs) {
            persistPruning();
            if (idempotency.ownerId === invocationId) {
                return { kind: 'claimed', leaseOwnerId: invocationId, leaseExpiresAt: new Date(idempotency.leaseExpiresAtMs).toISOString() };
            }
            return { kind: 'in_progress', retryAt: new Date(idempotency.leaseExpiresAtMs).toISOString() };
        }

        if (attemptsMs.length >= RATE_LIMIT_ATTEMPTS) {
            persistPruning();
            const oldestAttempt = attemptsMs[0];
            if (oldestAttempt === undefined) return invalidState();
            return { kind: 'rate_limited', retryAt: new Date(oldestAttempt + RATE_LIMIT_WINDOW_MS).toISOString() };
        }
        const dailyLimit = DAILY_ANSWER_LIMITS[input.entitlementClass];
        if (daily.answered + reservations.length >= dailyLimit) {
            persistPruning();
            return { kind: 'quota_exceeded', nextResetAt: resetAt.toISOString() };
        }

        const leaseExpiresAtMs = nowMs + LEASE_DURATION_MS;
        attemptsMs.push(nowMs);
        reservations.push({ requestId, ownerId: invocationId, expiresAtMs: leaseExpiresAtMs });
        const pending: PendingState = {
            status: 'pending', ownerId: invocationId, usageDateUtc: dateUtc,
            leaseExpiresAtMs, expiresAt: new Date(leaseExpiresAtMs),
        };
        transaction.set(documentPaths.rate, { attemptsMs, expiresAt: new Date(attemptsMs[0]! + RATE_LIMIT_WINDOW_MS) } satisfies RateState);
        transaction.set(documentPaths.daily, { ...daily, reservations, expiresAt: resetAt } satisfies DailyState);
        transaction.set(documentPaths.idempotency, pending);
        return { kind: 'claimed', leaseOwnerId: invocationId, leaseExpiresAt: new Date(leaseExpiresAtMs).toISOString() };
    });
}

function assertFinalizeStatus(response: NoorAnswer, expectedAnswered: boolean): NoorAnswer {
    let parsed: NoorAnswer;
    try { parsed = parseNoorAnswer(response); } catch { throw new Error('Invalid Noor final response'); }
    if ((parsed.status === 'answered') !== expectedAnswered) throw new Error('Invalid Noor final response status');
    return parsed;
}

async function finalize(input: FinalizeInput, expectedAnswered: boolean): Promise<FinalizeResult> {
    const uid = parseIdentifier(input.uid);
    const requestId = parseIdentifier(input.requestId, true);
    const invocationId = parseIdentifier(input.invocationId);
    const response = assertFinalizeStatus(input.response, expectedAnswered);
    if (response.requestId !== requestId) throw new Error('Invalid Noor final response');
    const now = nowFrom(input.clock);
    const nowMs = now.getTime();
    const idempotencyPath = `noorIdempotency/${uid}_${requestId}`;

    return input.repository.runTransaction(async (transaction): Promise<FinalizeResult> => {
        const idempotency = parseIdempotency(await transaction.get(idempotencyPath));
        if (idempotency?.status === 'completed') {
            if (idempotency.finalizedBy === invocationId) return { kind: 'already_finalized' };
            return invalidLease();
        }
        if (idempotency?.status !== 'pending'
            || idempotency.ownerId !== invocationId
            || idempotency.leaseExpiresAtMs <= nowMs) return invalidLease();

        const resetAt = new Date(`${idempotency.usageDateUtc}T00:00:00.000Z`);
        resetAt.setUTCDate(resetAt.getUTCDate() + 1);
        const dailyPath = `noorUsage/${uid}_${idempotency.usageDateUtc}`;
        const daily = parseDaily(await transaction.get(dailyPath), idempotency.usageDateUtc, resetAt);
        const matchingReservations = daily.reservations.filter((reservation) => (
            reservation.requestId === requestId && reservation.ownerId === invocationId
        ));
        if (matchingReservations.length !== 1) return invalidLease();
        const reservations = daily.reservations.filter((reservation) => !(
            reservation.requestId === requestId && reservation.ownerId === invocationId
        ));
        const answered = daily.answered + (expectedAnswered ? 1 : 0);
        if (answered > DAILY_ANSWER_LIMITS.owner_qa) return invalidState();
        const responseExpiresAtMs = nowMs + COMPLETED_REPLAY_MS;
        const completed: CompletedState = {
            status: 'completed', finalizedBy: invocationId, response,
            responseExpiresAtMs, expiresAt: new Date(responseExpiresAtMs),
        };
        transaction.set(dailyPath, { ...daily, answered, reservations } satisfies DailyState);
        transaction.set(idempotencyPath, completed);
        return { kind: 'finalized' };
    });
}

export function finalizeAnswered(input: FinalizeInput): Promise<FinalizeResult> {
    return finalize(input, true);
}

export function finalizeNonAnswer(input: FinalizeInput): Promise<FinalizeResult> {
    return finalize(input, false);
}

export function isNonAnswerStatus(status: NoorStatus): boolean {
    return status !== 'answered';
}
