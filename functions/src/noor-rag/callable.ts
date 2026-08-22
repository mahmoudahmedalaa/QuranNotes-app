import { GoogleGenAI } from '@google/genai';
import { getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { randomUUID } from 'node:crypto';

import { resolveNoorEntitlement } from './entitlement';
import { createVertexEmbedder, type VertexEmbeddingClient } from './embedding';
import {
    createEntitlementRepository,
    createUsageRepository,
    readDocument,
    readRuntimeConfig,
    verifyCorpusReady,
} from './firestore';
import { createVertexGenerationProvider, generateGroundedAnswer, type VertexGenerationClient } from './generation';
import { handleNoorRequest, type NoorSanitizedTrace } from './handler';
import { classifyRequestPolicy } from './policy';
import { parseValidatedConversationState } from './queryRewrite';
import {
    createFirestoreRetrievalRepository,
    retrieveEntitySummaryWithStats,
    retrieveExactVerse,
    retrieveSemanticWithStats,
} from './retrieval';
import { recordNoorSanitizedTrace, recordNoorTelemetry } from './telemetry';
import { claimRequest, finalizeAnswered, finalizeNonAnswer, readCompletedReplay } from './usage';
import { parseNoorRequest } from './validation';

export const NOOR_PROJECT = 'qurannotes-9f7a1' as const;
export const REVENUECAT_SECRET_API_KEY = defineSecret('REVENUECAT_SECRET_API_KEY');
export const NOOR_TELEMETRY_HMAC_KEY = defineSecret('NOOR_TELEMETRY_HMAC_KEY');

export interface NoorSanitizedTraceSinkInput {
    firestore: object;
    uid: string;
    secret: string;
    pseudonymKeyVersion: string | (() => string);
    traceId: string;
    now?: () => Date;
}

export function createNoorSanitizedTraceSink(input: NoorSanitizedTraceSinkInput): (trace: NoorSanitizedTrace) => Promise<void> {
    return trace => recordNoorSanitizedTrace({
        firestore: input.firestore,
        uid: input.uid,
        secret: input.secret,
        pseudonymKeyVersion: typeof input.pseudonymKeyVersion === 'function'
            ? input.pseudonymKeyVersion()
            : input.pseudonymKeyVersion,
        traceId: input.traceId,
        now: input.now?.() ?? new Date(),
        trace,
    });
}

export type { NoorSanitizedTrace } from './handler';

function requireProjectId(): typeof NOOR_PROJECT {
    const configured = getApp().options.projectId
        ?? process.env.GCLOUD_PROJECT
        ?? process.env.GOOGLE_CLOUD_PROJECT;
    if (configured !== NOOR_PROJECT) throw new Error('Noor project configuration is unavailable');
    return NOOR_PROJECT;
}

export async function callableHandler(request: CallableRequest<unknown>): Promise<unknown> {
    if (!request.auth?.uid) {
        throw new HttpsError('unauthenticated', 'You must be signed in to use Noor.');
    }
    let parsed;
    try {
        parsed = parseNoorRequest(request.data);
    } catch {
        throw new HttpsError('invalid-argument', 'The Noor request is invalid.');
    }

    let project: typeof NOOR_PROJECT;
    try {
        project = requireProjectId();
    } catch {
        throw new HttpsError('internal', 'Noor is temporarily unavailable.');
    }

    const uid = request.auth.uid;
    const invocationId = randomUUID();
    const serverTraceId = randomUUID();
    const firestore = getFirestore();
    const entitlementRepository = createEntitlementRepository(firestore);
    const usageRepository = createUsageRepository(firestore);
    const retrievalRepository = createFirestoreRetrievalRepository(firestore);
    const vertex = new GoogleGenAI({ vertexai: true, project, location: 'global' });
    const embedder = createVertexEmbedder(vertex.models as VertexEmbeddingClient);
    const generationProvider = createVertexGenerationProvider(
        project,
        () => vertex as unknown as VertexGenerationClient,
    );
    const revenueCatSecret = REVENUECAT_SECRET_API_KEY.value();
    const telemetrySecret = NOOR_TELEMETRY_HMAC_KEY.value();
    let telemetryKeyVersion = 'unavailable';

    return handleNoorRequest({
        request: parsed,
        uid,
        invocationId,
        dependencies: {
            loadRuntimeConfig: async () => {
                const config = await readRuntimeConfig(firestore);
                telemetryKeyVersion = config.pseudonymKeyVersion;
                return config;
            },
            verifyCorpusReady: config => verifyCorpusReady(firestore, config),
            readCompletedReplay: async input => readCompletedReplay(
                await readDocument(firestore, `noorIdempotency/${input.uid}_${input.requestId}`),
            ),
            resolveEntitlement: async input => resolveNoorEntitlement({
                firebaseUid: input.uid,
                revenueCatSecret,
                repository: entitlementRepository,
                fetcher: fetch,
                clock: () => new Date(),
            }),
            claimUsage: input => claimRequest({ ...input, repository: usageRepository }),
            classifyPolicy: classifyRequestPolicy,
            retrieveSemantic: input => retrieveSemanticWithStats({
                content: input.query,
                config: input.config,
                embedder,
                repository: retrievalRepository,
            }),
            retrieveEntitySummary: input => retrieveEntitySummaryWithStats({
                entity: input.entity,
                config: input.config,
                repository: retrievalRepository,
            }),
            retrieveExact: input => retrieveExactVerse({
                source: input.request.source,
                surah: input.request.surah,
                verse: input.request.verse,
                config: input.config,
                repository: retrievalRepository,
            }),
            generateGroundedAnswer: input => generateGroundedAnswer({
                request: input.request,
                evidence: input.evidence,
                maxEvidenceCharacters: input.config.maxEvidenceCharacters,
                provider: generationProvider,
                taskPlan: input.taskPlan,
            }),
            finalizeAnswered: input => finalizeAnswered({ ...input, repository: usageRepository }),
            finalizeNonAnswer: input => finalizeNonAnswer({ ...input, repository: usageRepository }),
            readValidatedConversationState: async input => parseValidatedConversationState(
                await readDocument(firestore, `noorConversationState/${input.uid}`),
            ),
            writeValidatedConversationState: async input => {
                await firestore.doc(`noorConversationState/${input.uid}`).set({
                    ...input.state,
                    expiresAt: new Date(input.state.expiresAt),
                }, { merge: false });
            },
            emitTelemetry: event => recordNoorTelemetry({
                firestore,
                uid,
                secret: telemetrySecret,
                pseudonymKeyVersion: telemetryKeyVersion,
                traceId: serverTraceId,
                now: new Date(),
                event,
            }),
            emitSanitizedTrace: createNoorSanitizedTraceSink({
                firestore,
                uid,
                secret: telemetrySecret,
                pseudonymKeyVersion: () => telemetryKeyVersion,
                traceId: serverTraceId,
            }),
            nowMs: Date.now,
        },
    });
}

export const askNoorRagV1 = onCall(
    {
        region: 'us-central1',
        memory: '512MiB',
        timeoutSeconds: 30,
        maxInstances: 10,
        concurrency: 20,
        enforceAppCheck: true,
        secrets: [REVENUECAT_SECRET_API_KEY, NOOR_TELEMETRY_HMAC_KEY],
    },
    callableHandler,
);
