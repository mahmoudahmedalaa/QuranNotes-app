import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NoorAnswer, NoorRequest } from '../../src/noor-rag/types';
import { parseNoorAnswer } from '../../src/noor-rag/validation';
import {
    buildCallableRequest,
    parseLiveSmokeCredentials,
    type LiveSmokeCredentials,
} from './live-smoke';
import {
    parseGoldenManifest,
    type GoldenCase,
    type GoldenManifest,
} from './golden';
import { readCorpusArtifacts } from './evaluate-golden';

interface LiveCitation {
    chunkId: string;
    canonicalUnitId: string;
    source: string;
    corpusVersion: string;
    verse: string;
    rank: number;
}

interface LiveCaseResult {
    id: string;
    requestCount: number;
    expectedStatus: string;
    actualStatus: string;
    passed: boolean;
    activeCorpusVersion: string | null;
    retrievedSourceIds: readonly string[];
    retrievedUnitIds: readonly string[];
    retrievedChunkIds: readonly string[];
    rankingPositions: Record<string, number | null>;
    citations: readonly LiveCitation[];
    latencyMs: number;
    errorClass: string | null;
}

interface LiveVerificationReport {
    status: 'PASSED' | 'FAILED' | 'UNVERIFIED';
    endpoint: string | null;
    corpusVersion: string;
    caseCount: number;
    requestCount: number;
    passedCaseCount: number;
    failedCaseIds: readonly string[];
    results?: readonly LiveCaseResult[];
    reason?: string;
}

const LIVE_CASE_IDS = [
    'riba-direct-01',
    'riba-followup-01',
    'patience-direct-01',
    'noah-story-01',
    'exact-verse-2-153',
    'unsupported-unrelated-01',
    'policy-personal-ruling-01',
] as const;
const MAX_HISTORY_ANSWER_CHARACTERS = 1_000;
const DEFAULT_REQUEST_INTERVAL_MS = 15_000;

export interface LiveRequestPacerOptions {
    intervalMs?: number;
    nowMs?: () => number;
    sleep?: (milliseconds: number) => Promise<void>;
}

export function createLiveRequestPacer(
    options: LiveRequestPacerOptions = {},
): () => Promise<void> {
    const intervalMs = options.intervalMs ?? DEFAULT_REQUEST_INTERVAL_MS;
    const nowMs = options.nowMs ?? Date.now;
    const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
    if (!Number.isSafeInteger(intervalMs) || intervalMs < 0) {
        throw new Error('Invalid live verification request interval');
    }
    let previousRequestAt: number | null = null;
    return async (): Promise<void> => {
        const now = nowMs();
        if (!Number.isFinite(now)) throw new Error('Invalid live verification clock');
        if (previousRequestAt !== null) {
            const remaining = intervalMs - (now - previousRequestAt);
            if (remaining > 0) await sleep(remaining);
        }
        previousRequestAt = nowMs();
    };
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function caseById(manifest: GoldenManifest, id: string): GoldenCase {
    const value = manifest.cases.find(item => item.id === id);
    if (!value) throw new Error(`Live golden case is missing: ${id}`);
    return value;
}

function safeErrorClass(status: number): string {
    if (status === 401) return 'auth_required';
    if (status === 403) return 'app_check_required';
    if (status === 429) return 'rate_limited';
    if (status >= 500) return 'temporarily_unavailable';
    return status >= 400 ? 'http_error' : 'malformed_response';
}

const SAFE_TRANSPORT_ERROR_CLASSES = new Set([
    'auth_required',
    'app_check_required',
    'rate_limited',
    'temporarily_unavailable',
    'http_error',
    'malformed_response',
    'request_id_mismatch',
]);

export function classifyLiveTransportError(error: unknown): string {
    return error instanceof Error && SAFE_TRANSPORT_ERROR_CLASSES.has(error.message)
        ? error.message
        : 'network_error';
}

export function boundedLiveHistoryAnswer(answer: string): string {
    return [...answer].slice(0, MAX_HISTORY_ANSWER_CHARACTERS).join('');
}

function answerFromResponse(status: number, body: unknown, expectedRequestId: string): NoorAnswer {
    if (status < 200 || status >= 300 || typeof body !== 'object' || body === null || Array.isArray(body)
        || !Object.prototype.hasOwnProperty.call(body, 'result')) {
        throw new Error(safeErrorClass(status));
    }
    const answer = parseNoorAnswer((body as { result: unknown }).result);
    if (answer.requestId !== expectedRequestId) throw new Error('request_id_mismatch');
    return answer;
}

function citationSnapshot(answer: NoorAnswer): LiveCitation[] {
    return answer.citations.map((citation, index) => ({
        chunkId: citation.chunkId,
        canonicalUnitId: citation.canonicalUnitId,
        source: citation.source,
        corpusVersion: citation.corpusVersion,
        verse: `${citation.surah}:${citation.verseStart}-${citation.verseEnd}`,
        rank: index + 1,
    }));
}

async function callNoor(
    request: NoorRequest,
    credentials: LiveSmokeCredentials,
    paceRequest: () => Promise<void>,
): Promise<{ answer: NoorAnswer; latencyMs: number }> {
    await paceRequest();
    const built = buildCallableRequest(request, credentials);
    const startedAt = Date.now();
    const response = await fetch(built.url, built.init);
    const body = await response.json() as unknown;
    return { answer: answerFromResponse(response.status, body, request.requestId), latencyMs: Math.max(0, Date.now() - startedAt) };
}

function expectedChunkIds(goldenCase: GoldenCase): string[] {
    return goldenCase.expectedEvidence.flatMap(evidence => [...evidence.chunkIds]);
}

export function expectedCitationEvidenceSatisfied(
    goldenCase: Pick<GoldenCase, 'exact' | 'expectedEvidence'>,
    citations: readonly Pick<LiveCitation, 'chunkId' | 'canonicalUnitId' | 'source'>[],
): boolean {
    if (goldenCase.exact) {
        const actualChunkIds = new Set(citations.map(citation => citation.chunkId));
        return goldenCase.expectedEvidence
            .flatMap(evidence => evidence.chunkIds)
            .every(chunkId => actualChunkIds.has(chunkId));
    }
    return goldenCase.expectedEvidence.some(expected => citations.some(citation => (
        citation.source === expected.source
        && citation.canonicalUnitId === expected.canonicalUnitId
        && expected.chunkIds.includes(citation.chunkId)
    )));
}

function validateResult(
    goldenCase: GoldenCase,
    answer: NoorAnswer,
    citations: readonly LiveCitation[],
    corpusVersion: string,
    artifacts: ReturnType<typeof readCorpusArtifacts>,
): { passed: boolean; rankingPositions: Record<string, number | null>; errorClass: string | null } {
    const actualChunkIds = new Set(citations.map(citation => citation.chunkId));
    const expectedIds = expectedChunkIds(goldenCase);
    const rankingPositions = Object.fromEntries(expectedIds.map(chunkId => [
        chunkId,
        citations.find(citation => citation.chunkId === chunkId)?.rank ?? null,
    ]));
    const chunksById = new Map(artifacts.chunks.map(chunk => [chunk.chunkId, chunk]));
    const citationsResolve = citations.every(citation => {
        const chunk = chunksById.get(citation.chunkId);
        return chunk !== undefined
            && chunk.canonicalUnitId === citation.canonicalUnitId
            && chunk.source === citation.source
            && corpusVersion === citation.corpusVersion;
    });
    const forbiddenChunkAbsent = goldenCase.forbiddenChunkIds.every(chunkId => !actualChunkIds.has(chunkId));
    const forbiddenStatus = !goldenCase.forbiddenStatuses.some(status => status === answer.status);
    const passed = answer.status === goldenCase.expectedStatus
        && citationsResolve
        && forbiddenChunkAbsent
        && forbiddenStatus
        && (goldenCase.expectedStatus !== 'answered'
            ? citations.length === 0
            : expectedCitationEvidenceSatisfied(goldenCase, citations));
    return {
        passed,
        rankingPositions,
        errorClass: passed ? null : answer.status,
    };
}

async function runCase(
    goldenCase: GoldenCase,
    credentials: LiveSmokeCredentials,
    corpusVersion: string,
    artifacts: ReturnType<typeof readCorpusArtifacts>,
    paceRequest: () => Promise<void>,
): Promise<LiveCaseResult> {
    const startedAt = Date.now();
    let answer: NoorAnswer;
    let requestCount = 0;
    try {
        if (goldenCase.exact) {
            const request = {
                mode: 'verse_summary' as const,
                requestId: randomUUID(),
                source: goldenCase.exact.source,
                surah: goldenCase.exact.surah,
                verse: goldenCase.exact.verse,
            };
            answer = (await callNoor(request, credentials, paceRequest)).answer;
            requestCount = 1;
        } else {
            const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];
            for (const question of goldenCase.turns) {
                const request = { mode: 'chat' as const, requestId: randomUUID(), question, history };
                answer = (await callNoor(request, credentials, paceRequest)).answer;
                requestCount += 1;
                history.push({ role: 'user', content: question });
                history.push({ role: 'assistant', content: boundedLiveHistoryAnswer(answer.answer) });
            }
        }
    } catch (error: unknown) {
        return {
            id: goldenCase.id,
            requestCount,
            expectedStatus: goldenCase.expectedStatus,
            actualStatus: 'transport_error',
            passed: false,
            activeCorpusVersion: null,
            retrievedSourceIds: [],
            retrievedUnitIds: [],
            retrievedChunkIds: [],
            rankingPositions: {},
            citations: [],
            latencyMs: Math.max(0, Date.now() - startedAt),
            errorClass: classifyLiveTransportError(error),
        };
    }
    const finalAnswer = answer!;
    const citations = citationSnapshot(finalAnswer);
    const activeVersions = [...new Set(citations.map(citation => citation.corpusVersion))];
    const activeCorpusVersion = activeVersions.length === 1 ? activeVersions[0]! : null;
    const validation = validateResult(goldenCase, finalAnswer, citations, corpusVersion, artifacts);
    return {
        id: goldenCase.id,
        requestCount,
        expectedStatus: goldenCase.expectedStatus,
        actualStatus: finalAnswer.status,
        passed: validation.passed,
        activeCorpusVersion,
        retrievedSourceIds: [...new Set(citations.map(citation => citation.source))],
        retrievedUnitIds: [...new Set(citations.map(citation => citation.canonicalUnitId))],
        retrievedChunkIds: citations.map(citation => citation.chunkId),
        rankingPositions: validation.rankingPositions,
        citations,
        latencyMs: Math.max(0, Date.now() - startedAt),
        errorClass: validation.errorClass,
    };
}

async function main(): Promise<void> {
    const version = '2026-08-10-v1';
    const casesPath = resolve(__dirname, '../../../evals/noor-golden-cases.json');
    const artifactsPath = resolve(__dirname, '../../../.generated/noor-corpus', version);
    const manifest = parseGoldenManifest(readJson(casesPath));
    if (manifest.corpusVersion !== version) throw new Error('Live golden corpus version is not locked');
    let credentials: LiveSmokeCredentials;
    try {
        credentials = parseLiveSmokeCredentials(process.env);
        if (new URL(credentials.endpoint).protocol !== 'https:') throw new Error('live endpoint must use HTTPS');
    } catch (error: unknown) {
        const report: LiveVerificationReport = {
            status: 'UNVERIFIED', endpoint: null, corpusVersion: version, caseCount: LIVE_CASE_IDS.length,
            requestCount: 0, passedCaseCount: 0, failedCaseIds: [],
            reason: error instanceof Error ? error.message : 'credentials_unavailable',
        };
        process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
        process.exitCode = 2;
        return;
    }
    const artifacts = readCorpusArtifacts(artifactsPath);
    const results: LiveCaseResult[] = [];
    const paceRequest = createLiveRequestPacer();
    for (const id of LIVE_CASE_IDS) {
        results.push(await runCase(caseById(manifest, id), credentials, version, artifacts, paceRequest));
    }
    const failedCaseIds = results.filter(result => !result.passed).map(result => result.id);
    const report: LiveVerificationReport = {
        status: failedCaseIds.length === 0 ? 'PASSED' : 'FAILED',
        endpoint: credentials.endpoint,
        corpusVersion: version,
        caseCount: results.length,
        requestCount: results.reduce((total, result) => total + result.requestCount, 0),
        passedCaseCount: results.filter(result => result.passed).length,
        failedCaseIds,
        results,
    };
    process.stdout.write(`${JSON.stringify(report, undefined, 2)}\n`);
    if (failedCaseIds.length > 0) process.exitCode = 1;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('Noor live verification failed; no provider details or credentials were emitted.\n');
        process.exitCode = 1;
    });
}
