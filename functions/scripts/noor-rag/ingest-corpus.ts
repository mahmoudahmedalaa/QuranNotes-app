import { GoogleGenAI } from '@google/genai';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    EMBEDDING_DIMENSION,
    EMBEDDING_MODEL,
    createVertexEmbedder,
    embedWithConcurrency,
    formatEmbeddingDocument,
    type Embedder,
} from '../../src/noor-rag/embedding';
import type { CorpusArtifacts, CorpusChunk, CorpusManifest } from '../../src/noor-rag/corpus';

export const LOCKED_PROJECT = 'qurannotes-9f7a1' as const;
export const LOCKED_CORPUS_VERSION = '2026-08-10-v1' as const;
export const VERTEX_LOCATION = 'global' as const;
const GENERATION_MODEL = 'gemini-3.5-flash-lite';
const MAX_BATCH_WRITES = 450;

export type IngestArtifacts = CorpusArtifacts;

export interface IngestOptions {
    execute: boolean;
    project: typeof LOCKED_PROJECT;
    version: typeof LOCKED_CORPUS_VERSION;
}

export interface RepositoryWrite {
    path: string;
    data: Readonly<Record<string, unknown>>;
}

export interface IngestRepository {
    readChunkMetadata(path: string): Promise<Record<string, unknown> | null>;
    writeBatch(writes: readonly RepositoryWrite[]): Promise<void>;
    writeManifest(path: string, data: Readonly<Record<string, unknown>>): Promise<void>;
}

export interface IngestResult {
    dryRun: boolean;
    complete: boolean;
    exitCode: 0 | 1;
    skipped: number;
    resumed: number;
    failedChunks: string[];
    failedWrites: string[];
    counts: {
        units: number;
        chunks: number;
        lookups: number;
        documents: number;
        embeddingTokens: number;
    };
}

interface IngestInput {
    options: IngestOptions;
    artifacts: IngestArtifacts;
    repository: IngestRepository;
    embedder: Embedder;
    report: (message: string) => void;
}

function valueArgument(args: readonly string[], name: string): string | undefined {
    const prefix = `--${name}=`;
    return args.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

export function parseIngestArguments(args: readonly string[]): IngestOptions {
    const execute = args.includes('--execute-production-write');
    const suppliedProject = valueArgument(args, 'project');
    const suppliedVersion = valueArgument(args, 'version');
    if (suppliedProject !== undefined && suppliedProject !== LOCKED_PROJECT) {
        throw new Error(`Only --project=${LOCKED_PROJECT} is permitted`);
    }
    if (suppliedVersion !== undefined && suppliedVersion !== LOCKED_CORPUS_VERSION) {
        throw new Error(`Only --version=${LOCKED_CORPUS_VERSION} is permitted`);
    }
    if (execute && suppliedProject !== LOCKED_PROJECT) {
        throw new Error(`Production writes require explicit --project=${LOCKED_PROJECT}`);
    }
    if (execute && suppliedVersion !== LOCKED_CORPUS_VERSION) {
        throw new Error(`Production writes require explicit --version=${LOCKED_CORPUS_VERSION}`);
    }
    const known = new Set([
        '--execute-production-write',
        ...(suppliedProject === undefined ? [] : [`--project=${suppliedProject}`]),
        ...(suppliedVersion === undefined ? [] : [`--version=${suppliedVersion}`]),
    ]);
    const unknown = args.find(value => !known.has(value));
    if (unknown) {
        throw new Error(`Unknown ingestion argument: ${unknown}`);
    }
    return {
        execute,
        project: LOCKED_PROJECT,
        version: LOCKED_CORPUS_VERSION,
    };
}

export function requireProductionVertexConfig(
    environment: Readonly<Record<string, string | undefined>>,
    options: IngestOptions,
): { project: typeof LOCKED_PROJECT; location: typeof VERTEX_LOCATION } {
    if (environment.GOOGLE_CLOUD_PROJECT !== options.project) {
        throw new Error(`Production ingestion requires GOOGLE_CLOUD_PROJECT=${LOCKED_PROJECT}`);
    }
    if (environment.GOOGLE_CLOUD_LOCATION !== VERTEX_LOCATION) {
        throw new Error(`Production ingestion requires GOOGLE_CLOUD_LOCATION=${VERTEX_LOCATION}`);
    }
    return { project: LOCKED_PROJECT, location: VERTEX_LOCATION };
}

function assertArtifactShape(artifacts: IngestArtifacts, version: string): void {
    if (artifacts.manifest.corpusVersion !== version
        || artifacts.manifest.unitCount !== artifacts.units.length
        || artifacts.manifest.chunkCount !== artifacts.chunks.length
        || artifacts.manifest.lookupCount !== artifacts.lookups.length
        || artifacts.units.some(unit => unit.corpusVersion !== version)
        || artifacts.chunks.some(chunk => chunk.corpusVersion !== version)) {
        throw new Error('Corpus artifact version or counts do not match the manifest');
    }
}

export function assertProductionArtifact(manifest: CorpusManifest): void {
    if (manifest.tokenizerMode !== 'vertex-validated-deterministic'
        || manifest.tokenizerModel !== GENERATION_MODEL
        || manifest.tokenValidation?.method !== 'vertex-compute-tokens-final-chunks'
        || manifest.tokenValidation.location !== VERTEX_LOCATION
        || manifest.tokenValidation.validatedChunkCount !== manifest.chunkCount) {
        throw new Error('Production ingestion requires an exact Vertex-validated deterministic corpus');
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canSkipChunk(chunk: CorpusChunk, metadata: Record<string, unknown> | null): boolean {
    const vector = metadata?.embeddingMetadata;
    return metadata?.contentHash === chunk.contentHash
        && metadata.embeddingModel === EMBEDDING_MODEL
        && metadata.embeddingDimension === EMBEDDING_DIMENSION
        && metadata.embeddingComplete === true
        && isRecord(vector)
        && vector.model === EMBEDDING_MODEL
        && vector.dimension === EMBEDDING_DIMENSION
        && vector.complete === true;
}

function countsFor(artifacts: IngestArtifacts): IngestResult['counts'] {
    return {
        units: artifacts.units.length,
        chunks: artifacts.chunks.length,
        lookups: artifacts.lookups.length,
        documents: artifacts.units.length + artifacts.chunks.length + artifacts.lookups.length + 1,
        embeddingTokens: artifacts.chunks.reduce((total, chunk) => total + chunk.tokenCount, 0),
    };
}

function safeReport(
    input: IngestInput,
    stage: 'dry-run' | 'pre-embedding' | 'pre-mutation' | 'final',
    details: Readonly<Record<string, unknown>>,
): void {
    input.report(`${JSON.stringify({
        stage,
        project: input.options.project,
        version: input.options.version,
        model: EMBEDDING_MODEL,
        dimension: EMBEDDING_DIMENSION,
        targetPaths: [
            `corpora/${input.options.version}/units/{unitId}`,
            `corpora/${input.options.version}/chunks/{chunkId}`,
            `corpora/${input.options.version}/verseLookup/{source}_{surah}_{verse}`,
            `corpusManifests/${input.options.version}`,
        ],
        ...details,
    }, undefined, 2)}\n`);
}

function unitWrite(version: string, unit: IngestArtifacts['units'][number]): RepositoryWrite {
    return {
        path: `corpora/${version}/units/${unit.canonicalUnitId}`,
        data: { ...unit, embeddingModel: EMBEDDING_MODEL, embeddingDimension: EMBEDDING_DIMENSION },
    };
}

function chunkWrite(
    version: string,
    chunk: CorpusChunk,
    embedding: readonly number[],
): RepositoryWrite {
    return {
        path: `corpora/${version}/chunks/${chunk.chunkId}`,
        data: {
            ...chunk,
            embeddingModel: EMBEDDING_MODEL,
            embeddingDimension: EMBEDDING_DIMENSION,
            embeddingComplete: true,
            embeddingMetadata: {
                model: EMBEDDING_MODEL,
                dimension: EMBEDDING_DIMENSION,
                complete: true,
            },
            embedding: FieldValue.vector([...embedding]),
        },
    };
}

function lookupWrite(version: string, lookup: IngestArtifacts['lookups'][number]): RepositoryWrite {
    return {
        path: `corpora/${version}/verseLookup/${lookup.lookupId}`,
        data: { ...lookup, corpusVersion: version },
    };
}

function manifestData(
    artifacts: IngestArtifacts,
    status: 'in_progress' | 'complete' | 'incomplete',
    skipped: number,
    written: number,
    failedChunks: readonly string[],
    failedWrites: readonly string[],
): Readonly<Record<string, unknown>> {
    return {
        ...artifacts.manifest,
        status,
        complete: status === 'complete',
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimension: EMBEDDING_DIMENSION,
        vectorIndex: {
            collectionGroup: 'chunks', corpusVersion: artifacts.manifest.corpusVersion,
            filters: ['corpusVersion', 'source'], dimension: EMBEDDING_DIMENSION,
        },
        expected: {
            units: artifacts.units.length, chunks: artifacts.chunks.length, lookups: artifacts.lookups.length,
            aggregateSha256: artifacts.manifest.aggregateSha256,
        },
        progress: { skippedChunks: skipped, resumedChunks: skipped, successfulWrites: written },
        failedChunks: [...failedChunks],
        failedWrites: [...failedWrites],
        updatedAt: FieldValue.serverTimestamp(),
        ...(status === 'complete' ? { completedAt: FieldValue.serverTimestamp() } : {}),
    };
}

export async function ingestCorpus(input: IngestInput): Promise<IngestResult> {
    assertArtifactShape(input.artifacts, input.options.version);
    const counts = countsFor(input.artifacts);
    if (!input.options.execute) {
        const plannedDataWrites = counts.units + counts.chunks + counts.lookups;
        const plannedManifestWrites = Math.ceil(plannedDataWrites / MAX_BATCH_WRITES) + 2;
        safeReport(input, 'dry-run', {
            counts,
            embeddingTokenEstimate: counts.embeddingTokens,
            plannedDataWrites,
            plannedManifestWrites,
            plannedTotalWrites: plannedDataWrites + plannedManifestWrites,
            actualWrites: 0,
            failed: 0,
            skipped: 0,
            resumed: 0,
            note: 'offline dry-run; no embedding or Firestore adapters called',
        });
        return {
            dryRun: true, complete: false, exitCode: 0, skipped: 0, resumed: 0,
            failedChunks: [], failedWrites: [], counts,
        };
    }
    assertProductionArtifact(input.artifacts.manifest);

    const skippedIds = new Set<string>();
    const pending: CorpusChunk[] = [];
    for (const chunk of input.artifacts.chunks) {
        const path = `corpora/${input.options.version}/chunks/${chunk.chunkId}`;
        if (canSkipChunk(chunk, await input.repository.readChunkMetadata(path))) {
            skippedIds.add(chunk.chunkId);
        } else {
            pending.push(chunk);
        }
    }
    safeReport(input, 'pre-embedding', {
        counts,
        embeddingTokenEstimate: pending.reduce((total, chunk) => total + chunk.tokenCount, 0),
        pendingEmbeddings: pending.length,
        failed: 0,
        skipped: skippedIds.size,
        resumed: skippedIds.size,
    });

    const embedded = await embedWithConcurrency(pending.map(
        chunk => formatEmbeddingDocument(chunk.sourceTitle, chunk.retrievalText),
    ), input.embedder);
    const failedChunks: string[] = [];
    const chunkWrites: RepositoryWrite[] = [];
    embedded.forEach((result, index) => {
        const chunk = pending[index];
        if (!chunk) {
            return;
        }
        if (result.ok) {
            chunkWrites.push(chunkWrite(input.options.version, chunk, result.embedding));
        } else {
            failedChunks.push(chunk.chunkId);
        }
    });
    const operations = [
        ...input.artifacts.units.map(unit => unitWrite(input.options.version, unit)),
        ...chunkWrites,
        ...input.artifacts.lookups.map(lookup => lookupWrite(input.options.version, lookup)),
    ];
    const batchCount = Math.ceil(operations.length / MAX_BATCH_WRITES);
    safeReport(input, 'pre-mutation', {
        counts,
        plannedDataWrites: operations.length,
        plannedManifestWrites: batchCount + 2,
        plannedTotalWrites: operations.length + batchCount + 2,
        failed: failedChunks.length,
        skipped: skippedIds.size,
        resumed: skippedIds.size,
    });

    const manifestPath = `corpusManifests/${input.options.version}`;
    const failedWrites: string[] = [];
    let written = 0;
    await input.repository.writeManifest(manifestPath, manifestData(
        input.artifacts, 'in_progress', skippedIds.size, written, failedChunks, failedWrites,
    ));
    for (let start = 0; start < operations.length; start += MAX_BATCH_WRITES) {
        const batch = operations.slice(start, start + MAX_BATCH_WRITES);
        try {
            await input.repository.writeBatch(batch);
            written += batch.length;
        } catch {
            failedWrites.push(...batch.map(write => write.path));
        }
        await input.repository.writeManifest(manifestPath, manifestData(
            input.artifacts, 'in_progress', skippedIds.size, written, failedChunks, failedWrites,
        ));
    }
    const complete = failedChunks.length === 0
        && failedWrites.length === 0
        && written === operations.length;
    await input.repository.writeManifest(manifestPath, manifestData(
        input.artifacts, complete ? 'complete' : 'incomplete',
        skippedIds.size, written, failedChunks, failedWrites,
    ));
    safeReport(input, 'final', {
        counts,
        successfulWrites: written,
        failed: failedChunks.length + failedWrites.length,
        failedChunks: failedChunks.length,
        failedWrites: failedWrites.length,
        skipped: skippedIds.size,
        resumed: skippedIds.size,
        complete,
    });
    return {
        dryRun: false,
        complete,
        exitCode: complete ? 0 : 1,
        skipped: skippedIds.size,
        resumed: skippedIds.size,
        failedChunks,
        failedWrites,
        counts,
    };
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadArtifacts(version: string): IngestArtifacts {
    const directory = resolve(__dirname, '../../..', '.generated/noor-corpus', version);
    return {
        units: readJson(resolve(directory, 'units.json')),
        chunks: readJson(resolve(directory, 'chunks.json')),
        lookups: readJson(resolve(directory, 'lookups.json')),
        manifest: readJson(resolve(directory, 'manifest.json')),
    } as IngestArtifacts;
}

async function productionAdapters(options: IngestOptions): Promise<{
    embedder: Embedder;
    repository: IngestRepository;
}> {
    const { project, location } = requireProductionVertexConfig(process.env, options);
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: project }, `noor-ingest-${Date.now()}`);
    const firestore = getFirestore(app);
    const client = new GoogleGenAI({ vertexai: true, project, location });
    return {
        embedder: createVertexEmbedder(client.models),
        repository: {
            readChunkMetadata: async (path: string): Promise<Record<string, unknown> | null> => {
                const snapshot = await firestore.doc(path).get();
                return snapshot.exists ? (snapshot.data() ?? null) : null;
            },
            writeBatch: async (writes: readonly RepositoryWrite[]): Promise<void> => {
                if (writes.length > MAX_BATCH_WRITES) {
                    throw new Error(`Firestore batch exceeds ${MAX_BATCH_WRITES} writes`);
                }
                const batch = firestore.batch();
                for (const write of writes) {
                    batch.set(firestore.doc(write.path), write.data, { merge: true });
                }
                await batch.commit();
            },
            writeManifest: async (path: string, data: Readonly<Record<string, unknown>>): Promise<void> => {
                await firestore.doc(path).set(data, { merge: true });
            },
        },
    };
}

async function main(): Promise<void> {
    const options = parseIngestArguments(process.argv.slice(2));
    const artifacts = loadArtifacts(options.version);
    if (!options.execute) {
        const unavailable = new Proxy({}, { get: () => { throw new Error('Dry-run adapter access is forbidden'); } });
        const result = await ingestCorpus({
            options,
            artifacts,
            repository: unavailable as IngestRepository,
            embedder: unavailable as Embedder,
            report: message => process.stdout.write(message),
        });
        process.exitCode = result.exitCode;
        return;
    }
    assertProductionArtifact(artifacts.manifest);
    const adapters = await productionAdapters(options);
    const result = await ingestCorpus({
        options,
        artifacts,
        ...adapters,
        report: message => process.stdout.write(message),
    });
    process.exitCode = result.exitCode;
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : 'Unknown corpus ingestion failure'}\n`);
        process.exitCode = 1;
    });
}
