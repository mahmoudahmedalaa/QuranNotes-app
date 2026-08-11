import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { parseNoorRuntimeConfig } from '../../src/noor-rag/config';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from '../../src/noor-rag/embedding';
import type { NoorSource } from '../../src/noor-rag/generatedContract';
import { validateProvenance } from '../../src/noor-rag/provenance';
import {
    LOCKED_CORPUS_VERSION,
    LOCKED_PROJECT,
    LOCKED_SOURCES,
    createAdminIndexProbe,
    createDeterministicProbeVector,
} from './verify-index';

export { LOCKED_CORPUS_VERSION, LOCKED_PROJECT };

export interface ActivationOptions {
    project: typeof LOCKED_PROJECT;
    version: typeof LOCKED_CORPUS_VERSION;
    expectedCurrent: string;
    execute: boolean;
}

export interface ExpectedManifest {
    corpusVersion: string;
    unitCount: number;
    chunkCount: number;
    lookupCount: number;
    aggregateSha256: string;
    largestChunkCharacters: number;
}

export interface ActivationRepository {
    readRuntimeConfig(): Promise<unknown>;
    readManifest(version: string): Promise<unknown>;
    activate(expectedCurrent: string, version: string): Promise<void>;
}

export interface ActivationPreflightResult {
    ready: boolean;
    exitCode: 0 | 1;
    blockers: string[];
}

export interface ActivationProvenanceReadiness {
    publicActivationApproved: boolean;
    blockers: string[];
}

function valueArgument(args: readonly string[], name: string): string | undefined {
    const prefix = `--${name}=`;
    return args.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

export function parseActivationArguments(args: readonly string[]): ActivationOptions {
    const project = valueArgument(args, 'project');
    const version = valueArgument(args, 'version');
    const expectedCurrent = valueArgument(args, 'expected-current');
    if (project !== LOCKED_PROJECT) throw new Error(`Corpus activation requires --project=${LOCKED_PROJECT}`);
    if (version !== LOCKED_CORPUS_VERSION) throw new Error(`Corpus activation requires --version=${LOCKED_CORPUS_VERSION}`);
    if (expectedCurrent !== 'none') throw new Error('Initial corpus activation requires --expected-current=none');
    const known = new Set([
        `--project=${project}`, `--version=${version}`, `--expected-current=${expectedCurrent}`,
        ...(args.includes('--execute-production-write') ? ['--execute-production-write'] : []),
    ]);
    const unknown = args.find(value => !known.has(value));
    if (unknown) throw new Error(`Unknown corpus activation argument: ${unknown}`);
    return {
        project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, expectedCurrent,
        execute: args.includes('--execute-production-write'),
    };
}

export function parseActivationPreflightArguments(args: readonly string[]): ActivationOptions {
    if (args.filter(value => value === '--preflight').length !== 1) {
        throw new Error('Activation preflight requires exactly one --preflight flag');
    }
    if (args.includes('--execute-production-write')) {
        throw new Error('Activation preflight is always zero-write');
    }
    return parseActivationArguments(args.filter(value => value !== '--preflight'));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function inspectActivationProvenance(
    value: unknown,
    currentUtcDate: string,
): ActivationProvenanceReadiness {
    const declaredBlockers = isRecord(value) && Array.isArray(value.activationBlockers)
        ? value.activationBlockers.filter((blocker): blocker is string => typeof blocker === 'string')
        : [];
    const validation = validateProvenance(value, { currentUtcDate });
    const valid = validation.errors.length === 0;
    return {
        publicActivationApproved: valid
            && isRecord(value)
            && value.publicActivationApproved === true
            && declaredBlockers.length === 0,
        blockers: [...(!valid ? ['provenance_record_invalid'] : []), ...new Set(declaredBlockers)],
    };
}

function positiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function assertExpectedManifest(value: ExpectedManifest, version: string): void {
    if (value.corpusVersion !== version
        || !positiveInteger(value.unitCount)
        || !positiveInteger(value.chunkCount)
        || !positiveInteger(value.lookupCount)
        || !/^[a-f0-9]{64}$/.test(value.aggregateSha256)
        || !positiveInteger(value.largestChunkCharacters)) {
        throw new Error('Invalid locked local corpus manifest');
    }
}

export function parseExpectedManifestArtifacts(
    manifest: unknown,
    chunks: unknown,
    version: string,
): ExpectedManifest {
    if (!isRecord(manifest)
        || typeof manifest.corpusVersion !== 'string'
        || !positiveInteger(manifest.unitCount)
        || !positiveInteger(manifest.chunkCount)
        || !positiveInteger(manifest.lookupCount)
        || typeof manifest.aggregateSha256 !== 'string'
        || !Array.isArray(chunks)
        || chunks.length !== manifest.chunkCount) {
        throw new Error('Invalid locked local corpus manifest');
    }
    const chunkLengths = chunks.map(chunk => {
        if (!isRecord(chunk) || typeof chunk.originalText !== 'string' || chunk.originalText.length === 0) {
            throw new Error('Invalid locked local corpus manifest');
        }
        return chunk.originalText.length;
    });
    const expected = {
        corpusVersion: manifest.corpusVersion,
        unitCount: manifest.unitCount,
        chunkCount: manifest.chunkCount,
        lookupCount: manifest.lookupCount,
        aggregateSha256: manifest.aggregateSha256,
        largestChunkCharacters: Math.max(...chunkLengths),
    };
    assertExpectedManifest(expected, version);
    return expected;
}

function assertProductionManifest(value: unknown, expected: ExpectedManifest): void {
    if (!isRecord(value) || !isRecord(value.expected)
        || value.status !== 'complete' || value.complete !== true
        || value.corpusVersion !== expected.corpusVersion
        || value.unitCount !== expected.unitCount
        || value.chunkCount !== expected.chunkCount
        || value.lookupCount !== expected.lookupCount
        || value.aggregateSha256 !== expected.aggregateSha256
        || value.expected.units !== expected.unitCount
        || value.expected.chunks !== expected.chunkCount
        || value.expected.lookups !== expected.lookupCount
        || value.expected.aggregateSha256 !== expected.aggregateSha256
        || value.embeddingModel !== EMBEDDING_MODEL
        || value.embeddingDimension !== EMBEDDING_DIMENSION
        || !Array.isArray(value.failedChunks) || value.failedChunks.length !== 0
        || !Array.isArray(value.failedWrites) || value.failedWrites.length !== 0) {
        throw new Error('Production ingestion manifest is incomplete or mismatched');
    }
}

export async function activateCorpus(input: {
    options: ActivationOptions;
    repository: ActivationRepository;
    expectedManifest: ExpectedManifest;
    publicActivationApproved: boolean;
    probeIndex(source: NoorSource): Promise<boolean>;
}): Promise<{ dryRun: boolean; version: typeof LOCKED_CORPUS_VERSION }> {
    if (!input.publicActivationApproved) {
        throw new Error('Corpus provenance public activation is not approved');
    }
    assertExpectedManifest(input.expectedManifest, input.options.version);
    const config = parseNoorRuntimeConfig(await input.repository.readRuntimeConfig());
    if (config.enabled || config.publicEnabled || config.ownerUids.length !== 0
        || config.activeCorpusVersion !== input.options.expectedCurrent) {
        throw new Error('Corpus activation requires the complete disabled, private, owner-empty runtime config');
    }
    assertProductionManifest(await input.repository.readManifest(input.options.version), input.expectedManifest);
    if (config.maxEvidenceCharacters < input.expectedManifest.largestChunkCharacters) {
        throw new Error('Runtime evidence budget is smaller than the largest finalized chunk');
    }
    for (const source of LOCKED_SOURCES) {
        if (!await input.probeIndex(source)) throw new Error(`Vector index is not ready for ${source}`);
    }
    if (input.options.execute) {
        await input.repository.activate(input.options.expectedCurrent, input.options.version);
    }
    return { dryRun: !input.options.execute, version: LOCKED_CORPUS_VERSION };
}

export async function preflightActivation(input: {
    options: ActivationOptions;
    repository: ActivationRepository;
    expectedManifest: ExpectedManifest | null;
    publicActivationApproved: boolean;
    provenanceBlockers: readonly string[];
    probeIndex(source: NoorSource): Promise<boolean>;
}): Promise<ActivationPreflightResult> {
    const blockers: string[] = [];
    const provenanceBlockers = [...new Set(input.provenanceBlockers)];
    if (!input.publicActivationApproved || provenanceBlockers.length > 0) {
        blockers.push(...(provenanceBlockers.length > 0
            ? provenanceBlockers.map(blocker => `provenance:${blocker}`)
            : ['provenance:public_activation_not_approved']));
    }

    let localManifestValid = input.expectedManifest !== null;
    if (input.expectedManifest === null) {
        blockers.push('locked_local_corpus_manifest_invalid');
    } else {
        try {
            assertExpectedManifest(input.expectedManifest, input.options.version);
        } catch {
            localManifestValid = false;
            blockers.push('locked_local_corpus_manifest_invalid');
        }
    }

    let config: ReturnType<typeof parseNoorRuntimeConfig> | undefined;
    try {
        config = parseNoorRuntimeConfig(await input.repository.readRuntimeConfig());
        if (config.enabled || config.publicEnabled || config.ownerUids.length !== 0
            || config.activeCorpusVersion !== input.options.expectedCurrent) {
            blockers.push('runtime_config_not_disabled_private_owner_empty_or_expected_current');
        }
    } catch {
        blockers.push('runtime_config_missing_or_invalid');
    }

    if (localManifestValid && input.expectedManifest !== null) {
        try {
            assertProductionManifest(await input.repository.readManifest(input.options.version), input.expectedManifest);
        } catch {
            blockers.push('production_ingestion_manifest_incomplete_or_mismatched');
        }
        if (config && config.maxEvidenceCharacters < input.expectedManifest.largestChunkCharacters) {
            blockers.push('runtime_evidence_budget_smaller_than_largest_chunk');
        }
    }

    for (const source of LOCKED_SOURCES) {
        try {
            if (!await input.probeIndex(source)) blockers.push(`vector_index_not_ready:${source}`);
        } catch {
            blockers.push(`vector_index_not_ready:${source}`);
        }
    }

    return { ready: blockers.length === 0, exitCode: blockers.length === 0 ? 0 : 1, blockers };
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function loadExpectedManifest(version: string): ExpectedManifest {
    const directory = resolve(__dirname, '../../..', '.generated/noor-corpus', version);
    const manifest = readJson(resolve(directory, 'manifest.json'));
    const chunks = readJson(resolve(directory, 'chunks.json'));
    return parseExpectedManifestArtifacts(manifest, chunks, version);
}

async function createRepository(options: ActivationOptions): Promise<ActivationRepository> {
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: options.project }, `noor-activate-${Date.now()}`);
    const firestore = getFirestore(app);
    const runtime = firestore.doc('noorConfig/runtime');
    return {
        readRuntimeConfig: async () => {
            const snapshot = await runtime.get();
            return snapshot.exists ? snapshot.data() : null;
        },
        readManifest: async version => {
            const snapshot = await firestore.doc(`corpusManifests/${version}`).get();
            return snapshot.exists ? snapshot.data() : null;
        },
        activate: async (expectedCurrent, version) => firestore.runTransaction(async transaction => {
            const snapshot = await transaction.get(runtime);
            const current = parseNoorRuntimeConfig(snapshot.exists ? snapshot.data() : null);
            if (current.enabled || current.publicEnabled || current.ownerUids.length !== 0
                || current.activeCorpusVersion !== expectedCurrent) {
                throw new Error('Runtime config changed during corpus activation');
            }
            transaction.update(runtime, { activeCorpusVersion: version });
        }),
    };
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const preflight = args.includes('--preflight');
    const options = preflight ? parseActivationPreflightArguments(args) : parseActivationArguments(args);
    const repositoryRoot = resolve(__dirname, '../../../..');
    const provenance = readJson(resolve(repositoryRoot, 'docs/noor-rag/corpus-provenance.json'));
    const provenanceReadiness = inspectActivationProvenance(
        provenance, new Date().toISOString().slice(0, 10),
    );
    if (!preflight && !provenanceReadiness.publicActivationApproved) {
        throw new Error('Corpus provenance public activation is not approved');
    }
    const indexProbe = await createAdminIndexProbe(options);
    const vector = createDeterministicProbeVector();
    const repository = await createRepository(options);
    let expectedManifest: ExpectedManifest | null;
    try {
        expectedManifest = loadExpectedManifest(options.version);
    } catch (error: unknown) {
        if (!preflight) throw error;
        expectedManifest = null;
    }
    const probeIndex = async (source: NoorSource): Promise<boolean> => {
        try {
            const response = await indexProbe.query({ ...options, source, vector, limit: 1 });
            return response.count === 1 && response.corpusVersion === options.version && response.source === source;
        } catch {
            return false;
        }
    };
    if (preflight) {
        const result = await preflightActivation({
            options, repository, expectedManifest,
            publicActivationApproved: provenanceReadiness.publicActivationApproved,
            provenanceBlockers: provenanceReadiness.blockers, probeIndex,
        });
        process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
        process.exitCode = result.exitCode;
        return;
    }
    if (expectedManifest === null) throw new Error('Invalid locked local corpus manifest');
    const result = await activateCorpus({
        options,
        repository,
        expectedManifest,
        publicActivationApproved: provenanceReadiness.publicActivationApproved,
        probeIndex,
    });
    process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : 'Corpus activation failed'}\n`);
        process.exitCode = 1;
    });
}
