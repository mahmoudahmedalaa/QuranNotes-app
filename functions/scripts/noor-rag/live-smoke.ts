import { randomUUID } from 'node:crypto';

import type { NoorRequest, NoorStatus } from '../../src/noor-rag/types';
import { parseNoorAnswer } from '../../src/noor-rag/validation';

export type LiveSmokeMode = 'chat' | 'conversation' | 'verse-parity' | 'quota';
export type LiveSmokeStatus = NoorStatus | 'transport_error' | 'malformed_response' | 'verse_mismatch';

export interface LiveSmokeCredentials {
    endpoint: string;
    firebaseIdToken: string;
    appCheckToken: string;
}

export interface LiveSmokeOptions {
    mode: LiveSmokeMode;
    count: number;
    intervalMs: number;
    allowLiveQuota: boolean;
    credentialsFromStdin: boolean;
    help: boolean;
}

export interface LiveSmokeCitationReference {
    source: 'ibn_kathir_en_abridged' | 'al_sadi_ar';
    surah: number;
    verseStart: number;
    verseEnd: number;
}

export interface LiveSmokeObservation {
    status: LiveSmokeStatus;
    citations: readonly LiveSmokeCitationReference[];
    errorClass: string | null;
    answerForHistory?: string;
    transportDiagnostics?: CallableErrorDiagnostics;
}

export interface LiveSmokeResult {
    case: string;
    status: LiveSmokeStatus;
    citationCount: number;
    citations: readonly { source: LiveSmokeCitationReference['source']; verse: string }[];
    latencyMs: number;
    errorClass: string | null;
    transportDiagnostics?: CallableErrorDiagnostics;
}

export interface CallableErrorDiagnostics {
    clientRequestId: string;
    httpStatus: number;
    callableErrorCode: string | null;
    callableErrorStatus: string | null;
    callableErrorMessage: string | null;
    cloudTrace: string | null;
}

export interface BuiltCallableRequest {
    url: string;
    init: {
        method: 'POST';
        headers: Record<string, string>;
        body: string;
    };
}

export interface LiveSmokeReport {
    mode: LiveSmokeMode;
    requestCount: number;
    safetyNotice?: string;
    results: readonly LiveSmokeResult[];
}

type ChatHistory = Array<{ role: 'user' | 'assistant'; content: string }>;

export const MAX_NOOR_HISTORY_TURNS = 6;

const DEFAULT_INTERVAL_MS = 12_000;
const DAILY_LIMIT = 50;
const MAX_LIVE_QUOTA_COUNT = 100;
const MAX_HISTORY_ANSWER_CHARACTERS = 1_800;
const LIVE_QUOTA_NOTICE = 'Live quota mode consumes real entitlement; keep --interval-ms at least 12000 to respect the 5 RPM limiter.';
const SAFE_CHAT_QUESTION = 'Explain one Quranic teaching about patience using tafsir evidence.';
const CONVERSATION_TURNS = [
    'What does patience mean in Quranic tafsir?',
    'Which verse or tafsir source supports that?',
    'Can you summarize the practical lesson?',
] as const;
const VERSE_CASES = [
    { label: 'verse-a-2:153', surah: 2, verse: 153 },
    { label: 'verse-b-2:155', surah: 2, verse: 155 },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonblank(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '';
}

function parseInteger(value: string, name: string, minimum: number): number {
    if (!/^\d+$/u.test(value)) throw new Error(`${name} must be a non-negative integer`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum) throw new Error(`${name} is out of range`);
    return parsed;
}

function parseMode(value: string): LiveSmokeMode {
    if (value === 'chat' || value === 'conversation' || value === 'verse-parity' || value === 'quota') return value;
    throw new Error('mode must be chat, conversation, verse-parity, or quota');
}

export function parseLiveSmokeOptions(argv: readonly string[]): LiveSmokeOptions {
    let mode: LiveSmokeMode = 'chat';
    let count = 1;
    let intervalMs = DEFAULT_INTERVAL_MS;
    let allowLiveQuota = false;
    let credentialsFromStdin = false;
    let help = false;

    for (const argument of argv) {
        if (argument === '--allow-live-quota') {
            allowLiveQuota = true;
        } else if (argument === '--credentials-stdin') {
            credentialsFromStdin = true;
        } else if (argument === '--help' || argument === '-h') {
            help = true;
        } else if (argument.startsWith('--mode=')) {
            mode = parseMode(argument.slice('--mode='.length));
        } else if (argument.startsWith('--count=')) {
            count = parseInteger(argument.slice('--count='.length), 'count', 1);
        } else if (argument.startsWith('--interval-ms=')) {
            intervalMs = parseInteger(argument.slice('--interval-ms='.length), 'interval-ms', 0);
        } else {
            throw new Error(`unknown option: ${argument}`);
        }
    }

    if (count > MAX_LIVE_QUOTA_COUNT) {
        throw new Error(`count cannot exceed ${MAX_LIVE_QUOTA_COUNT}`);
    }
    if (mode === 'quota' && count > DAILY_LIMIT && !allowLiveQuota) {
        throw new Error(`count above ${DAILY_LIMIT} requires --allow-live-quota because real calls consume entitlement`);
    }

    return { mode, count, intervalMs, allowLiveQuota, credentialsFromStdin, help };
}

function validateEndpoint(value: unknown): string {
    if (!nonblank(value)) throw new Error('Noor live smoke endpoint is required');
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('unsupported protocol');
        return url.toString();
    } catch {
        throw new Error('Noor live smoke endpoint must be an HTTP(S) URL');
    }
}

function readCredentialField(
    environment: NodeJS.ProcessEnv,
    stdinRecord: Record<string, unknown>,
    environmentKey: string,
    stdinKey: string,
): string {
    const value = environment[environmentKey] ?? stdinRecord[stdinKey];
    if (!nonblank(value)) throw new Error(`${environmentKey} is required`);
    return value;
}

export function parseLiveSmokeCredentials(
    environment: NodeJS.ProcessEnv,
    stdinText = '',
): LiveSmokeCredentials {
    let stdinRecord: Record<string, unknown> = {};
    if (stdinText.trim() !== '') {
        let parsed: unknown;
        try {
            parsed = JSON.parse(stdinText) as unknown;
        } catch {
            throw new Error('credential stdin must contain a JSON object');
        }
        if (!isRecord(parsed)) throw new Error('credential stdin must contain a JSON object');
        stdinRecord = parsed;
    }

    return {
        endpoint: validateEndpoint(environment.NOOR_LIVE_SMOKE_ENDPOINT ?? stdinRecord.endpoint),
        firebaseIdToken: readCredentialField(environment, stdinRecord, 'NOOR_LIVE_SMOKE_FIREBASE_ID_TOKEN', 'firebaseIdToken'),
        appCheckToken: readCredentialField(environment, stdinRecord, 'NOOR_LIVE_SMOKE_APP_CHECK_TOKEN', 'appCheckToken'),
    };
}

export function buildCallableRequest(request: NoorRequest, credentials: LiveSmokeCredentials): BuiltCallableRequest {
    const boundedRequest = request.mode === 'chat'
        ? { ...request, history: boundNoorHistory(request.history) }
        : request;
    return {
        url: credentials.endpoint,
        init: {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${credentials.firebaseIdToken}`,
                'X-Firebase-AppCheck': credentials.appCheckToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: boundedRequest }),
        },
    };
}

export function boundNoorHistory(history: ChatHistory): ChatHistory {
    return history.slice(-MAX_NOOR_HISTORY_TURNS);
}

type HeaderReader = { get(name: string): string | null } | ReadonlyMap<string, string>;

function readHeader(headers: HeaderReader | undefined, name: string): string | null {
    if (!headers) return null;
    const value = headers instanceof Map ? headers.get(name) : headers.get(name);
    return typeof value === 'string' && value.length > 0 ? value.slice(0, 256) : null;
}

function safeCallableText(value: unknown): string | null {
    if (typeof value !== 'string' || value.length === 0) return null;
    return value.replace(/[\u0000-\u001F\u007F]/gu, '').slice(0, 256);
}

export function parseCallableErrorDiagnostics(
    httpStatus: number,
    body: unknown,
    clientRequestId: string,
    headers?: HeaderReader,
): CallableErrorDiagnostics {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    const callableErrorCode = safeCallableText(error?.code);
    const callableErrorStatus = safeCallableText(error?.status)?.toUpperCase() ?? null;
    const callableErrorMessage = safeCallableText(error?.message);
    const cloudTrace = readHeader(headers, 'x-cloud-trace-context')
        ?? readHeader(headers, 'x-cloud-trace-id')
        ?? readHeader(headers, 'traceparent');
    return {
        clientRequestId,
        httpStatus,
        callableErrorCode,
        callableErrorStatus,
        callableErrorMessage,
        cloudTrace,
    };
}

function errorClassForStatus(status: NoorStatus): string | null {
    if (status === 'answered') return null;
    if (status === 'insufficient_evidence') return 'insufficient_evidence';
    if (status === 'policy_refusal') return 'policy_refusal';
    if (status === 'not_entitled') return 'entitlement_required';
    if (status === 'quota_exceeded') return 'quota_exceeded';
    if (status === 'invalid_request') return 'invalid_request';
    return 'temporarily_unavailable';
}

function transportErrorClass(httpStatus: number, body: unknown): string {
    const errorStatus = isRecord(body) && isRecord(body.error) && typeof body.error.status === 'string'
        ? body.error.status.toUpperCase()
        : '';
    if (httpStatus === 401 || errorStatus === 'UNAUTHENTICATED') return 'auth_required';
    if (httpStatus === 403 || errorStatus === 'FAILED_PRECONDITION' || errorStatus === 'PERMISSION_DENIED') return 'app_check_required';
    if (httpStatus === 429 || errorStatus === 'RESOURCE_EXHAUSTED') return 'rate_limited';
    if (errorStatus === 'INVALID_ARGUMENT' || httpStatus === 400) return 'invalid_request';
    if (httpStatus >= 500 || ['INTERNAL', 'UNAVAILABLE', 'DEADLINE_EXCEEDED'].includes(errorStatus)) return 'temporarily_unavailable';
    return 'http_error';
}

function citationReference(value: unknown): LiveSmokeCitationReference | null {
    if (!isRecord(value)) return null;
    const source = value.source;
    const surah = value.surah;
    const verseStart = value.verseStart;
    const verseEnd = value.verseEnd;
    if ((source !== 'ibn_kathir_en_abridged' && source !== 'al_sadi_ar')
        || typeof surah !== 'number' || !Number.isSafeInteger(surah)
        || typeof verseStart !== 'number' || !Number.isSafeInteger(verseStart)
        || typeof verseEnd !== 'number' || !Number.isSafeInteger(verseEnd)) return null;
    return {
        source: source as LiveSmokeCitationReference['source'],
        surah: surah as number,
        verseStart: verseStart as number,
        verseEnd: verseEnd as number,
    };
}

export function parseCallableResponse(
    httpStatus: number,
    body: unknown,
    expectedRequestId: string,
    headers?: HeaderReader,
): LiveSmokeObservation {
    if (httpStatus < 200 || httpStatus >= 300) {
        return {
            status: 'transport_error',
            citations: [],
            errorClass: transportErrorClass(httpStatus, body),
            transportDiagnostics: parseCallableErrorDiagnostics(httpStatus, body, expectedRequestId, headers),
        };
    }

    const result = isRecord(body) && Object.prototype.hasOwnProperty.call(body, 'result') ? body.result : undefined;
    try {
        const answer = parseNoorAnswer(result);
        if (answer.requestId !== expectedRequestId) throw new Error('request id mismatch');
        const citations = answer.citations.map(citationReference).filter((citation): citation is LiveSmokeCitationReference => citation !== null);
        return {
            status: answer.status,
            citations,
            errorClass: errorClassForStatus(answer.status),
            answerForHistory: answer.answer,
        };
    } catch {
        return { status: 'malformed_response', citations: [], errorClass: 'malformed_response' };
    }
}

export function redactLiveSmokeResult(caseLabel: string, latencyMs: number, observation: LiveSmokeObservation): LiveSmokeResult {
    return {
        case: caseLabel,
        status: observation.status,
        citationCount: observation.citations.length,
        citations: observation.citations.map(citation => ({
            source: citation.source,
            verse: `${citation.surah}:${citation.verseStart}-${citation.verseEnd}`,
        })),
        latencyMs,
        errorClass: observation.errorClass,
        ...(observation.transportDiagnostics ? { transportDiagnostics: observation.transportDiagnostics } : {}),
    };
}

function hasExpectedVerse(observation: LiveSmokeObservation, surah: number, verse: number): boolean {
    return observation.citations.some(citation => (
        citation.surah === surah && citation.verseStart <= verse && citation.verseEnd >= verse
    ));
}

function requestId(): string {
    return randomUUID();
}

function chatRequest(question: string, history: ChatHistory): NoorRequest {
    return { mode: 'chat', requestId: requestId(), question, history };
}

type FetchImplementation = (input: string, init: BuiltCallableRequest['init']) => Promise<{
    status: number;
    json(): Promise<unknown>;
    headers?: HeaderReader;
}>;

async function executeRequest(
    caseLabel: string,
    request: NoorRequest,
    credentials: LiveSmokeCredentials,
    fetchImpl: FetchImplementation,
    expectedVerse?: { surah: number; verse: number },
): Promise<{ result: LiveSmokeResult; answerForHistory?: string }> {
    const startedAt = Date.now();
    let observation: LiveSmokeObservation;
    try {
        const built = buildCallableRequest(request, credentials);
        const response = await fetchImpl(built.url, built.init);
        const body = await response.json();
        observation = parseCallableResponse(response.status, body, request.requestId, response.headers);
    } catch {
        observation = { status: 'transport_error', citations: [], errorClass: 'network_error' };
    }

    if (expectedVerse && observation.status === 'answered' && !hasExpectedVerse(observation, expectedVerse.surah, expectedVerse.verse)) {
        observation = { ...observation, status: 'verse_mismatch', errorClass: 'verse_mismatch' };
    }

    return {
        result: redactLiveSmokeResult(caseLabel, Math.max(0, Date.now() - startedAt), observation),
        answerForHistory: observation.answerForHistory,
    };
}

function boundedHistoryAnswer(answer: string | undefined): string {
    const safe = nonblank(answer) ? answer : 'No answer was returned.';
    return safe.slice(0, MAX_HISTORY_ANSWER_CHARACTERS);
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export async function runLiveSmoke(
    options: LiveSmokeOptions,
    credentials: LiveSmokeCredentials,
    fetchImpl: FetchImplementation = async (input, init) => fetch(input, init),
    sleepImpl: (milliseconds: number) => Promise<void> = sleep,
): Promise<LiveSmokeReport> {
    const results: LiveSmokeResult[] = [];
    const run = async (label: string, request: NoorRequest, expectedVerse?: { surah: number; verse: number }): Promise<string | undefined> => {
        const executed = await executeRequest(label, request, credentials, fetchImpl, expectedVerse);
        results.push(executed.result);
        return executed.answerForHistory;
    };

    if (options.mode === 'chat') {
        await run('chat', chatRequest(SAFE_CHAT_QUESTION, []));
    } else if (options.mode === 'conversation') {
        const history: ChatHistory = [];
        for (const [index, question] of CONVERSATION_TURNS.entries()) {
            const answer = await run(`conversation-turn-${index + 1}`, chatRequest(question, boundNoorHistory(history)));
            history.push({ role: 'user', content: question });
            history.push({ role: 'assistant', content: boundedHistoryAnswer(answer) });
        }
    } else if (options.mode === 'verse-parity') {
        for (const verseCase of VERSE_CASES) {
            await run(verseCase.label, {
                mode: 'verse_summary',
                requestId: requestId(),
                source: 'al_sadi_ar',
                surah: verseCase.surah,
                verse: verseCase.verse,
            }, verseCase);
        }
    } else {
        for (let index = 0; index < options.count; index += 1) {
            await run(`quota-request-${index + 1}`, chatRequest(SAFE_CHAT_QUESTION, []));
            if (index < options.count - 1 && options.intervalMs > 0) await sleepImpl(options.intervalMs);
        }
    }

    return {
        mode: options.mode,
        requestCount: results.length,
        ...(options.mode === 'quota' ? { safetyNotice: LIVE_QUOTA_NOTICE } : {}),
        results,
    };
}

function usage(): string {
    return [
        'Noor live smoke (network is opt-in by supplying credentials)',
        '  --mode=chat|conversation|verse-parity|quota',
        '  --count=N --interval-ms=N (quota mode; defaults 1 and 12000)',
        '  --allow-live-quota (required above 50; hard maximum 100)',
        '  --credentials-stdin (JSON: endpoint, firebaseIdToken, appCheckToken)',
        '  Environment alternatives: NOOR_LIVE_SMOKE_ENDPOINT, NOOR_LIVE_SMOKE_FIREBASE_ID_TOKEN, NOOR_LIVE_SMOKE_APP_CHECK_TOKEN',
    ].join('\n');
}

async function readStdin(): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
    const options = parseLiveSmokeOptions(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return;
    }
    const stdinText = options.credentialsFromStdin ? await readStdin() : '';
    const credentials = parseLiveSmokeCredentials(process.env, stdinText);
    const report = await runLiveSmoke(options, credentials);
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('Noor live smoke failed. Check safe configuration and credentials; no provider details were emitted.\n');
        process.exitCode = 1;
    });
}
