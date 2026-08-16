import { auth } from '../../../core/firebase/config';
import { getQuranNotesAppCheckToken } from '../../../core/firebase/AppCheckService';
import { NoorAnswer, NoorCitation, NoorRequest, NoorStatus } from '../domain/generatedContract';

const ENDPOINT = 'https://us-central1-qurannotes-9f7a1.cloudfunctions.net/askNoorRagV1';
const DEFAULT_TIMEOUT_MS = 25_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;
const MAX_ANSWER_CHARACTERS = 10_000;
const MAX_IDENTIFIER_CHARACTERS = 256;
const MAX_SOURCE_TITLE_CHARACTERS = 200;
const MAX_CORPUS_VERSION_CHARACTERS = 128;
const SURAH_VERSE_COUNTS: readonly number[] = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
    135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11,
    11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25,
    22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3,
    6, 3, 5, 4, 5, 6,
];
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

function isBoundedNonblankString(value: unknown, maximum: number): value is string {
    if (typeof value !== 'string' || value.trim() === '') return false;
    let length = 0;
    for (const codePoint of value) {
        length += codePoint.codePointAt(0) === undefined ? 0 : 1;
        if (length > maximum) return false;
    }
    return true;
}

function isValidQuranReference(surah: unknown, verse: unknown): boolean {
    if (!isPositiveInteger(surah) || !isPositiveInteger(verse) || surah > SURAH_VERSE_COUNTS.length) return false;
    const verseCount = SURAH_VERSE_COUNTS[surah - 1];
    return verseCount !== undefined && verse <= verseCount;
}

function isCitation(value: unknown): value is NoorCitation {
    if (!isRecord(value) || !hasExactKeys(value, [
        'chunkId', 'canonicalUnitId', 'source', 'sourceTitle', 'surah', 'verseStart', 'verseEnd', 'corpusVersion',
    ])) return false;
    return isBoundedNonblankString(value.chunkId, MAX_IDENTIFIER_CHARACTERS)
        && isBoundedNonblankString(value.canonicalUnitId, MAX_IDENTIFIER_CHARACTERS)
        && (value.source === 'ibn_kathir_en_abridged' || value.source === 'al_sadi_ar')
        && isBoundedNonblankString(value.sourceTitle, MAX_SOURCE_TITLE_CHARACTERS)
        && isValidQuranReference(value.surah, value.verseStart)
        && isValidQuranReference(value.surah, value.verseEnd)
        && typeof value.verseStart === 'number'
        && typeof value.verseEnd === 'number'
        && value.verseEnd >= value.verseStart
        && isBoundedNonblankString(value.corpusVersion, MAX_CORPUS_VERSION_CHARACTERS);
}

function isUtcTimestamp(value: unknown): value is string {
    if (typeof value !== 'string') return false;
    const match = UTC_TIMESTAMP_PATTERN.exec(value);
    if (!match) return false;
    const milliseconds = (match[2] ?? '').padEnd(3, '0');
    const canonical = `${match[1]}.${milliseconds || '000'}Z`;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === canonical;
}

function isNoorAnswer(value: unknown): value is NoorAnswer {
    if (!isRecord(value)
        || typeof value.requestId !== 'string'
        || !UUID_PATTERN.test(value.requestId)
        || !isBoundedNonblankString(value.answer, MAX_ANSWER_CHARACTERS)
        || typeof value.status !== 'string'
        || !STATUSES.has(value.status as NoorStatus)
        || !Array.isArray(value.citations)
        || !value.citations.every(isCitation)) return false;
    if (value.status === 'answered' && value.citations.length === 0) return false;

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
