import { createHmac } from 'node:crypto';

import type { NoorHandlerTelemetryEvent } from './handler';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;
const MAX_SUBJECT_ENTRIES = 10;

interface SnapshotLike { exists: boolean; data(): unknown }
interface ReferenceLike { path?: string; get(): Promise<SnapshotLike>; set(value: unknown, options: { merge: false }): Promise<void> }
interface TransactionLike { get(reference: ReferenceLike): Promise<SnapshotLike>; set(reference: ReferenceLike, value: unknown, options: { merge: false }): void }
interface FirestoreLike { doc(path: string): ReferenceLike; runTransaction<T>(worker: (transaction: TransactionLike) => Promise<T>): Promise<T> }

interface TelemetryInput {
    firestore: object;
    uid: string;
    secret: string;
    pseudonymKeyVersion: string;
    traceId: string;
    now: Date;
    event: NoorHandlerTelemetryEvent;
}

interface SubjectEntry { pseudonym: string; pseudonymKeyVersion: string }

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEntries(value: unknown): SubjectEntry[] {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > MAX_SUBJECT_ENTRIES) throw new Error('Invalid Noor telemetry subject');
    return value.map(item => {
        if (!isRecord(item) || typeof item.pseudonym !== 'string' || typeof item.pseudonymKeyVersion !== 'string') {
            throw new Error('Invalid Noor telemetry subject');
        }
        return { pseudonym: item.pseudonym, pseudonymKeyVersion: item.pseudonymKeyVersion };
    });
}

export function createNoorPseudonym(uid: string, secret: string): string {
    if (!uid || !secret) throw new Error('Invalid Noor telemetry identity');
    return createHmac('sha256', secret).update(uid, 'utf8').digest('hex');
}

export async function recordNoorTelemetry(input: TelemetryInput): Promise<void> {
    if (!Number.isFinite(input.now.getTime()) || !input.pseudonymKeyVersion || !input.traceId) {
        throw new Error('Invalid Noor telemetry input');
    }
    const db = input.firestore as FirestoreLike;
    const pseudonym = createNoorPseudonym(input.uid, input.secret);
    const createdAt = new Date(input.now.getTime());
    const expiresAt = new Date(input.now.getTime() + RETENTION_MS);
    const telemetry = {
        ...input.event,
        pseudonym,
        pseudonymKeyVersion: input.pseudonymKeyVersion,
        serverTraceId: input.traceId,
        createdAt,
        expiresAt,
    };
    await db.doc(`noorTelemetry/${input.traceId}`).set(telemetry, { merge: false });
    await db.runTransaction(async transaction => {
        const reference = db.doc(`noorTelemetrySubjects/${input.uid}`);
        const snapshot = await transaction.get(reference);
        const data = snapshot.exists ? snapshot.data() : undefined;
        if (data !== undefined && !isRecord(data)) throw new Error('Invalid Noor telemetry subject');
        const entries = parseEntries(data?.entries);
        const next = { pseudonym, pseudonymKeyVersion: input.pseudonymKeyVersion };
        const unique = entries.filter(entry => entry.pseudonym !== pseudonym || entry.pseudonymKeyVersion !== input.pseudonymKeyVersion);
        unique.push(next);
        transaction.set(reference, { entries: unique.slice(-MAX_SUBJECT_ENTRIES), updatedAt: createdAt }, { merge: false });
    });
}
