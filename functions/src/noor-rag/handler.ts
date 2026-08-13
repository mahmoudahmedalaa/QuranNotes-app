import type { NoorRuntimeConfig } from './config';
import type { EntitlementDecision } from './entitlement';
import { getGenerationDiagnostics, type NoorGenerationErrorClass } from './generation';
import type { NoorPolicyCategory } from './policy';
import type { ClaimResult, FinalizeResult, NoorEntitlementClass } from './usage';
import type { NoorAnswer, NoorRequest, RetrievedEvidence } from './types';
import { parseNoorAnswer } from './validation';

const POLICY_REFUSAL = 'Noor only explains Quran passages using Tafsir Ibn Kathir and Tafsir Al-Sa\'di. For personal rulings, please speak with a qualified scholar.';
const SCOPE_REFUSAL = 'I’m Noor, focused on the Qur’an and Islamic tafsir. I can help explain verses, tafsir, and Qur’an-related questions.';
const INSUFFICIENT_EVIDENCE = 'I could not find the answer in the available Tafsir Ibn Kathir and Tafsir Al-Sa\'di passages.';
const TEMPORARILY_UNAVAILABLE = 'Noor is temporarily unavailable. Please try again shortly.';
const NOT_ENTITLED = 'Noor is available with an active QuranNotes subscription.';
const QUOTA_EXCEEDED = 'You have reached today\'s Noor answer limit. Please try again after the reset.';
const MAX_TELEMETRY_DURATION_MS = 120_000;
const MAX_TELEMETRY_CHUNK_IDS = 8;
const MAX_TELEMETRY_CHUNK_ID_CHARACTERS = 256;

export type NoorHandlerErrorClass =
    | 'config_unavailable'
    | 'corpus_unavailable'
    | 'replay_invalid'
    | 'entitlement_unavailable'
    | 'not_entitled'
    | 'usage_unavailable'
    | 'quota_exceeded'
    | 'request_busy'
    | 'policy_refusal'
    | 'insufficient_evidence'
    | 'retrieval_unavailable'
    | 'generation_unavailable'
    | NoorGenerationErrorClass
    | 'response_invalid'
    | 'finalization_unavailable'
    | null;

export interface NoorHandlerTelemetryEvent {
    requestId: string;
    mode: NoorRequest['mode'];
    entitlementClass: NoorEntitlementClass | null;
    generationModel: string | null;
    corpusVersion: string | null;
    promptVersion: string | null;
    outcome: NoorAnswer['status'];
    citationCount: number;
    retrievedChunkIds: string[];
    errorClass: NoorHandlerErrorClass;
    durationMs: number;
    retrievalMs: number;
    generationMs: number;
}

export interface NoorHandlerUsageInput {
    uid: string;
    requestId: string;
    invocationId: string;
    entitlementClass: NoorEntitlementClass;
}

export interface NoorHandlerFinalizeInput {
    uid: string;
    requestId: string;
    invocationId: string;
    response: NoorAnswer;
}

export interface NoorHandlerDependencies {
    loadRuntimeConfig(): Promise<NoorRuntimeConfig>;
    verifyCorpusReady(config: NoorRuntimeConfig): Promise<boolean>;
    readCompletedReplay(input: Readonly<{ uid: string; requestId: string }>): Promise<unknown | null>;
    resolveEntitlement(input: Readonly<{ uid: string }>): Promise<EntitlementDecision>;
    claimUsage(input: NoorHandlerUsageInput): Promise<ClaimResult>;
    classifyPolicy(request: NoorRequest): NoorPolicyCategory;
    retrieveSemantic(input: Readonly<{ request: Extract<NoorRequest, { mode: 'chat' }>; config: NoorRuntimeConfig }>): Promise<readonly RetrievedEvidence[]>;
    retrieveExact(input: Readonly<{
        request: Extract<NoorRequest, { mode: 'verse_summary' | 'verse_question' }>;
        config: NoorRuntimeConfig;
    }>): Promise<readonly RetrievedEvidence[]>;
    generateGroundedAnswer(input: Readonly<{
        request: NoorRequest;
        evidence: readonly RetrievedEvidence[];
        config: NoorRuntimeConfig;
    }>): Promise<unknown>;
    finalizeAnswered(input: NoorHandlerFinalizeInput): Promise<FinalizeResult>;
    finalizeNonAnswer(input: NoorHandlerFinalizeInput): Promise<FinalizeResult>;
    emitTelemetry(event: NoorHandlerTelemetryEvent): Promise<void> | void;
    nowMs(): number;
}

export interface HandleNoorRequestInput {
    request: NoorRequest;
    uid: string;
    invocationId: string;
    dependencies: NoorHandlerDependencies;
}

class HandlerFailure extends Error {
    constructor(readonly errorClass: Exclude<NoorHandlerErrorClass, null>) {
        super(errorClass);
    }
}

function nonQuotaAnswer(requestId: string, status: Exclude<NoorAnswer['status'], 'quota_exceeded' | 'answered'>, answer: string): NoorAnswer {
    return { requestId, status, answer, citations: [] };
}

function temporaryAnswer(requestId: string): NoorAnswer {
    return nonQuotaAnswer(requestId, 'temporarily_unavailable', TEMPORARILY_UNAVAILABLE);
}

function safeNow(dependencies: NoorHandlerDependencies): number {
    try {
        const value = dependencies.nowMs();
        return Number.isFinite(value) ? value : 0;
    } catch {
        return 0;
    }
}

function duration(startedAt: number, endedAt: number): number {
    if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) return 0;
    return Math.max(0, Math.min(MAX_TELEMETRY_DURATION_MS, Math.floor(endedAt - startedAt)));
}

function validateResponse(value: unknown, requestId: string): NoorAnswer {
    let response: NoorAnswer;
    try {
        response = parseNoorAnswer(value);
    } catch {
        throw new HandlerFailure('response_invalid');
    }
    if (response.requestId !== requestId) throw new HandlerFailure('response_invalid');
    return response;
}

function responseErrorClass(response: NoorAnswer): NoorHandlerErrorClass {
    switch (response.status) {
        case 'answered': return null;
        case 'policy_refusal': return 'policy_refusal';
        case 'insufficient_evidence': return 'insufficient_evidence';
        case 'not_entitled': return 'not_entitled';
        case 'quota_exceeded': return 'quota_exceeded';
        case 'temporarily_unavailable': return 'generation_unavailable';
        case 'invalid_request': return 'response_invalid';
    }
}

export async function handleNoorRequest(input: HandleNoorRequestInput): Promise<NoorAnswer> {
    const { request, uid, invocationId, dependencies } = input;
    const startedAt = safeNow(dependencies);
    let config: NoorRuntimeConfig | null = null;
    let entitlementClass: NoorEntitlementClass | null = null;
    let retrievedChunkIds: string[] = [];
    let retrievalMs = 0;
    let generationMs = 0;

    const finish = async (response: NoorAnswer, errorClass: NoorHandlerErrorClass): Promise<NoorAnswer> => {
        const event: NoorHandlerTelemetryEvent = {
            requestId: request.requestId,
            mode: request.mode,
            entitlementClass,
            generationModel: config?.generationModel ?? null,
            corpusVersion: config?.activeCorpusVersion ?? null,
            promptVersion: config?.promptVersion ?? null,
            outcome: response.status,
            citationCount: response.citations.length,
            retrievedChunkIds: retrievedChunkIds
                .slice(0, MAX_TELEMETRY_CHUNK_IDS)
                .map(chunkId => chunkId.slice(0, MAX_TELEMETRY_CHUNK_ID_CHARACTERS)),
            errorClass,
            durationMs: duration(startedAt, safeNow(dependencies)),
            retrievalMs,
            generationMs,
        };
        try {
            Promise.resolve(dependencies.emitTelemetry(event)).catch(() => undefined);
        } catch {
            // Telemetry is best effort and must never alter an application outcome.
        }
        return response;
    };

    try {
        config = await dependencies.loadRuntimeConfig();
    } catch {
        return finish(temporaryAnswer(request.requestId), 'config_unavailable');
    }
    if (!config.enabled || (!config.publicEnabled && !config.ownerUids.includes(uid))) {
        return finish(temporaryAnswer(request.requestId), 'config_unavailable');
    }
    if (config.activeCorpusVersion === 'none') {
        return finish(temporaryAnswer(request.requestId), 'corpus_unavailable');
    }
    try {
        if (!await dependencies.verifyCorpusReady(config)) {
            return finish(temporaryAnswer(request.requestId), 'corpus_unavailable');
        }
    } catch {
        return finish(temporaryAnswer(request.requestId), 'corpus_unavailable');
    }

    let replay: unknown | null;
    try {
        replay = await dependencies.readCompletedReplay({ uid, requestId: request.requestId });
    } catch {
        return finish(temporaryAnswer(request.requestId), 'replay_invalid');
    }
    if (replay !== null) {
        try {
            const response = validateResponse(replay, request.requestId);
            return finish(response, responseErrorClass(response));
        } catch {
            return finish(temporaryAnswer(request.requestId), 'replay_invalid');
        }
    }

    let entitlement: EntitlementDecision;
    try {
        entitlement = await dependencies.resolveEntitlement({ uid });
    } catch {
        return finish(temporaryAnswer(request.requestId), 'entitlement_unavailable');
    }
    entitlementClass = entitlement.class;
    if (entitlement.class === 'none') {
        return finish(nonQuotaAnswer(request.requestId, 'not_entitled', NOT_ENTITLED), 'not_entitled');
    }

    let claim: ClaimResult;
    try {
        claim = await dependencies.claimUsage({
            uid, requestId: request.requestId, invocationId, entitlementClass: entitlement.class,
        });
    } catch {
        return finish(temporaryAnswer(request.requestId), 'usage_unavailable');
    }
    if (claim.kind === 'replay') {
        try {
            const response = validateResponse(claim.response, request.requestId);
            return finish(response, responseErrorClass(response));
        } catch {
            return finish(temporaryAnswer(request.requestId), 'replay_invalid');
        }
    }
    if (claim.kind === 'quota_exceeded') {
        return finish({
            requestId: request.requestId, status: 'quota_exceeded', answer: QUOTA_EXCEEDED,
            citations: [], nextResetAt: claim.nextResetAt,
        }, 'quota_exceeded');
    }
    if (claim.kind === 'rate_limited' || claim.kind === 'in_progress') {
        return finish(temporaryAnswer(request.requestId), 'request_busy');
    }

    const finalizationInput = (response: NoorAnswer): NoorHandlerFinalizeInput => ({
        uid, requestId: request.requestId, invocationId, response,
    });
    try {
        const policy = dependencies.classifyPolicy(request);
        if (policy !== 'allowed') {
            const response = nonQuotaAnswer(request.requestId, 'policy_refusal', policy === 'out_of_scope' ? SCOPE_REFUSAL : POLICY_REFUSAL);
            await dependencies.finalizeNonAnswer(finalizationInput(response));
            return finish(response, 'policy_refusal');
        }

        let evidence: readonly RetrievedEvidence[];
        const retrievalStartedAt = safeNow(dependencies);
        try {
            evidence = request.mode === 'chat'
                ? await dependencies.retrieveSemantic({ request, config })
                : await dependencies.retrieveExact({ request, config });
        } catch {
            throw new HandlerFailure('retrieval_unavailable');
        } finally {
            retrievalMs = duration(retrievalStartedAt, safeNow(dependencies));
        }
        retrievedChunkIds = evidence.map(item => item.chunk.chunkId);
        if (evidence.length === 0) {
            const response = nonQuotaAnswer(request.requestId, 'insufficient_evidence', INSUFFICIENT_EVIDENCE);
            await dependencies.finalizeNonAnswer(finalizationInput(response));
            return finish(response, 'insufficient_evidence');
        }

        let generated: unknown;
        const generationStartedAt = safeNow(dependencies);
        try {
            generated = await dependencies.generateGroundedAnswer({ request, evidence, config });
        } catch {
            throw new HandlerFailure('generation_unavailable');
        } finally {
            generationMs = duration(generationStartedAt, safeNow(dependencies));
        }
        const generationDiagnostics = getGenerationDiagnostics(generated);
        const response = validateResponse(generated, request.requestId);
        if (response.status === 'answered') {
            try {
                await dependencies.finalizeAnswered(finalizationInput(response));
            } catch {
                throw new HandlerFailure('finalization_unavailable');
            }
        } else {
            await dependencies.finalizeNonAnswer(finalizationInput(response));
        }
        return finish(response, generationDiagnostics?.errorClass ?? responseErrorClass(response));
    } catch (error) {
        const response = temporaryAnswer(request.requestId);
        try {
            await dependencies.finalizeNonAnswer(finalizationInput(response));
        } catch {
            // The reservation lease may expire; never return an unaccounted answer.
        }
        const errorClass = error instanceof HandlerFailure ? error.errorClass : 'finalization_unavailable';
        return finish(response, errorClass);
    }
}
