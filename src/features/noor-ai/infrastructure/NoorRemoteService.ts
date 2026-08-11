import { auth } from '../../../core/firebase/config';
import { getQuranNotesAppCheckToken } from '../../../core/firebase/AppCheckService';
import { NoorAnswer, NoorCitation, NoorRequest, NoorStatus } from '../domain/generatedContract';

const ENDPOINT = 'https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1';
const DEFAULT_TIMEOUT_MS = 25_000;
const STATUSES: ReadonlySet<NoorStatus> = new Set([
    'answered',
    'insufficient_evidence',
    'policy_refusal',
    'not_entitled',
    'quota_exceeded',
    'invalid_request',
    'temporarily_unavailable',
]);

export type NoorTransportErrorCode = 'signed_out' | 'temporarily_unavailable' | 'invalid_response';

export class NoorTransportError extends Error {
    constructor(readonly code: NoorTransportErrorCode) {
        super(code === 'signed_out' ? 'Please sign in to use Noor.' : 'Noor is temporarily unavailable.');
        this.name = 'NoorTransportError';
    }
}

export interface NoorRemoteClient {
    ask(request: NoorRequest): Promise<NoorAnswer>;
}

interface NoorRemoteDependencies {
    getAuthToken: () => Promise<string>;
    getAppCheckToken: () => Promise<string>;
    fetchImpl: typeof fetch;
    timeoutMs: number;
}

type NoorRemoteOverrides = Partial<NoorRemoteDependencies>;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isCitation(value: unknown): value is NoorCitation {
    if (!isRecord(value) || !hasExactKeys(value, [
        'chunkId', 'canonicalUnitId', 'source', 'sourceTitle', 'surah', 'verseStart', 'verseEnd', 'corpusVersion',
    ])) return false;
    return typeof value.chunkId === 'string'
        && typeof value.canonicalUnitId === 'string'
        && (value.source === 'ibn_kathir_en_abridged' || value.source === 'al_sadi_ar')
        && typeof value.sourceTitle === 'string'
        && isPositiveInteger(value.surah)
        && value.surah <= 114
        && isPositiveInteger(value.verseStart)
        && isPositiveInteger(value.verseEnd)
        && value.verseEnd >= value.verseStart
        && typeof value.corpusVersion === 'string';
}

function isUtcTimestamp(value: unknown): value is string {
    return typeof value === 'string' && value.endsWith('Z') && !Number.isNaN(Date.parse(value));
}

function isNoorAnswer(value: unknown): value is NoorAnswer {
    if (!isRecord(value)
        || typeof value.requestId !== 'string'
        || typeof value.answer !== 'string'
        || typeof value.status !== 'string'
        || !STATUSES.has(value.status as NoorStatus)
        || !Array.isArray(value.citations)
        || !value.citations.every(isCitation)) return false;

    if (value.status === 'quota_exceeded') {
        return hasExactKeys(value, ['requestId', 'answer', 'status', 'citations', 'nextResetAt'])
            && isUtcTimestamp(value.nextResetAt);
    }
    return hasExactKeys(value, ['requestId', 'answer', 'status', 'citations']);
}

async function defaultAuthToken(): Promise<string> {
    const user = auth.currentUser;
    if (!user) throw new NoorTransportError('signed_out');
    const token = await user.getIdToken();
    if (!token) throw new NoorTransportError('signed_out');
    return token;
}

export function createNoorRemoteService(overrides: NoorRemoteOverrides = {}): NoorRemoteClient {
    const dependencies: NoorRemoteDependencies = {
        getAuthToken: defaultAuthToken,
        getAppCheckToken: () => getQuranNotesAppCheckToken(),
        fetchImpl: fetch,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        ...overrides,
    };

    return {
        async ask(request: NoorRequest): Promise<NoorAnswer> {
            let authToken: string;
            let appCheckToken: string;
            try {
                authToken = await dependencies.getAuthToken();
                if (!authToken) throw new NoorTransportError('signed_out');
                appCheckToken = await dependencies.getAppCheckToken();
                if (!appCheckToken) throw new NoorTransportError('temporarily_unavailable');
            } catch (error: unknown) {
                if (error instanceof NoorTransportError) throw error;
                throw new NoorTransportError('temporarily_unavailable');
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), dependencies.timeoutMs);
            try {
                const response = await dependencies.fetchImpl(ENDPOINT, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                        'X-Firebase-AppCheck': appCheckToken,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ data: request }),
                    signal: controller.signal,
                });
                if (!response.ok) throw new NoorTransportError('temporarily_unavailable');
                const envelope: unknown = await response.json();
                if (!isRecord(envelope)
                    || !hasExactKeys(envelope, ['result'])
                    || !isNoorAnswer(envelope.result)
                    || envelope.result.requestId !== request.requestId) {
                    throw new NoorTransportError('invalid_response');
                }
                return envelope.result;
            } catch (error: unknown) {
                if (error instanceof NoorTransportError) throw error;
                throw new NoorTransportError('temporarily_unavailable');
            } finally {
                clearTimeout(timeout);
            }
        },
    };
}

export const noorRemoteService = createNoorRemoteService();
