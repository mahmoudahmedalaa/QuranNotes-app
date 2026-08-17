import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { parseNoorRuntimeConfig, type NoorRuntimeConfig } from '../../src/noor-rag/config';
import { EMBEDDING_DIMENSION, EMBEDDING_MODEL } from '../../src/noor-rag/embedding';
import {
    retrieveExactVerse,
    type RetrievalRepository,
    type StoredDocument,
} from '../../src/noor-rag/retrieval';
import type { CorpusArtifacts } from '../../src/noor-rag/corpus';
import {
    parseGoldenManifest,
    validateGoldenAgainstCorpus,
    type GoldenCase,
    type GoldenManifest,
} from './golden';

export interface GoldenLocalCaseResult {
    id: string;
    mode: 'exact' | 'semantic';
    status: 'passed' | 'failed' | 'deferred_to_live';
    expectedChunkIds: readonly string[];
    actualChunkIds: readonly string[];
    actualSourceIds: readonly string[];
    actualUnitIds: readonly string[];
    rankingPositions: Record<string, number | null>;
}

export interface GoldenLocalEvaluation {
    corpusVersion: string;
    executedExactCases: number;
    deferredSemanticCases: number;
    casePassRate: number;
    expectedEvidenceHitRate: number;
    failedCaseIds: readonly string[];
    cases: readonly GoldenLocalCaseResult[];
}

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

export function readCorpusArtifacts(directory: string): CorpusArtifacts {
    return {
        units: readJson(resolve(directory, 'units.json')) as CorpusArtifacts['units'],
        chunks: readJson(resolve(directory, 'chunks.json')) as CorpusArtifacts['chunks'],
        lookups: readJson(resolve(directory, 'lookups.json')) as CorpusArtifacts['lookups'],
        manifest: readJson(resolve(directory, 'manifest.json')) as CorpusArtifacts['manifest'],
    };
}

function localRuntimeConfig(corpusVersion: string): NoorRuntimeConfig {
    return parseNoorRuntimeConfig({
        enabled: true,
        publicEnabled: true,
        ownerUids: [],
        activeCorpusVersion: corpusVersion,
        promptVersion: 'local-golden-evaluator',
        generationModel: 'gemini-3.5-flash-lite',
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
        pseudonymKeyVersion: 'local',
        sourceThresholds: { ibn_kathir_en_abridged: 0.35, al_sadi_ar: 0.35 },
        maxChunksPerSource: 4,
        maxEvidenceCharacters: 50000,
    });
}

function fileRepository(artifacts: CorpusArtifacts): RetrievalRepository {
    const documents = new Map<string, StoredDocument>();
    const corpusVersion = artifacts.manifest.corpusVersion;
    for (const lookup of artifacts.lookups) {
        documents.set(
            `corpora/${corpusVersion}/verseLookup/${lookup.lookupId}`,
            { id: lookup.lookupId, data: { ...lookup, corpusVersion } },
        );
    }
    for (const unit of artifacts.units) {
        documents.set(
            `corpora/${unit.corpusVersion}/units/${unit.canonicalUnitId}`,
            { id: unit.canonicalUnitId, data: { ...unit, embeddingModel: EMBEDDING_MODEL, embeddingDimension: EMBEDDING_DIMENSION } },
        );
    }
    for (const chunk of artifacts.chunks) {
        documents.set(
            `corpora/${chunk.corpusVersion}/chunks/${chunk.chunkId}`,
            { id: chunk.chunkId, data: { ...chunk, embeddingModel: EMBEDDING_MODEL, embeddingDimension: EMBEDDING_DIMENSION } },
        );
    }
    return {
        readDocument: async path => documents.get(path) ?? null,
        readDocuments: async paths => paths
            .map(path => documents.get(path))
            .filter((document): document is StoredDocument => document !== undefined),
        searchChunks: async () => {
            throw new Error('Local golden evaluator does not fabricate semantic vectors; use noor:verify:live');
        },
    };
}

function expectedChunkIds(goldenCase: GoldenCase): string[] {
    return goldenCase.expectedEvidence.flatMap(evidence => [...evidence.chunkIds]);
}

function exactCaseResult(
    goldenCase: GoldenCase,
    actualChunkIds: readonly string[],
    actualSourceIds: readonly string[],
    actualUnitIds: readonly string[],
    topK: number,
): GoldenLocalCaseResult {
    const expected = expectedChunkIds(goldenCase);
    const rankingPositions = Object.fromEntries(expected.map(chunkId => [
        chunkId,
        actualChunkIds.indexOf(chunkId) >= 0 ? actualChunkIds.indexOf(chunkId) + 1 : null,
    ]));
    const expectedSources = new Set(goldenCase.expectedEvidence.map(evidence => evidence.source));
    const expectedUnits = new Set(goldenCase.expectedEvidence.map(evidence => evidence.canonicalUnitId));
    const passed = goldenCase.expectedStatus === 'answered'
        && expected.every(chunkId => (rankingPositions[chunkId] ?? Number.MAX_SAFE_INTEGER) <= topK)
        && [...expectedSources].every(source => actualSourceIds.includes(source))
        && [...expectedUnits].every(unit => actualUnitIds.includes(unit))
        && goldenCase.forbiddenChunkIds.every(chunkId => !actualChunkIds.includes(chunkId));
    return {
        id: goldenCase.id,
        mode: 'exact',
        status: passed ? 'passed' : 'failed',
        expectedChunkIds: expected,
        actualChunkIds,
        actualSourceIds,
        actualUnitIds,
        rankingPositions,
    };
}

export async function evaluateExactGoldenCases(
    manifest: GoldenManifest,
    artifacts: CorpusArtifacts,
): Promise<GoldenLocalEvaluation> {
    const corpusValidation = validateGoldenAgainstCorpus(manifest, artifacts);
    if (!corpusValidation.valid) throw new Error(corpusValidation.errors.join('\n'));
    const config = localRuntimeConfig(manifest.corpusVersion);
    const repository = fileRepository(artifacts);
    const cases: GoldenLocalCaseResult[] = [];
    for (const goldenCase of manifest.cases) {
        if (!goldenCase.exact) {
            cases.push({
                id: goldenCase.id,
                mode: 'semantic',
                status: 'deferred_to_live',
                expectedChunkIds: expectedChunkIds(goldenCase),
                actualChunkIds: [],
                actualSourceIds: [],
                actualUnitIds: [],
                rankingPositions: {},
            });
            continue;
        }
        const evidence = await retrieveExactVerse({
            source: goldenCase.exact.source,
            surah: goldenCase.exact.surah,
            verse: goldenCase.exact.verse,
            config,
            repository,
        });
        cases.push(exactCaseResult(
            goldenCase,
            evidence.map(item => item.chunk.chunkId),
            evidence.map(item => item.chunk.source),
            evidence.map(item => item.chunk.canonicalUnitId),
            manifest.topK,
        ));
    }
    const exactCases = cases.filter(item => item.mode === 'exact');
    const passed = exactCases.filter(item => item.status === 'passed');
    const expectedHits = exactCases.filter(item => item.expectedChunkIds.every(chunkId => item.actualChunkIds.includes(chunkId)));
    const failedCaseIds = cases.filter(item => item.status === 'failed').map(item => item.id);
    return {
        corpusVersion: manifest.corpusVersion,
        executedExactCases: exactCases.length,
        deferredSemanticCases: cases.length - exactCases.length,
        casePassRate: exactCases.length === 0 ? 0 : passed.length / exactCases.length,
        expectedEvidenceHitRate: exactCases.length === 0 ? 0 : expectedHits.length / exactCases.length,
        failedCaseIds,
        cases,
    };
}

function argument(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
    const version = argument('version');
    const casesPath = argument('cases') ?? resolve(__dirname, '../../../evals/noor-golden-cases.json');
    if (!version) throw new Error('--version is required');
    const directory = resolve(__dirname, '../../../.generated/noor-corpus', version);
    const manifest = parseGoldenManifest(readJson(casesPath));
    const result = await evaluateExactGoldenCases(manifest, readCorpusArtifacts(directory));
    process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);
    if (result.failedCaseIds.length > 0) process.exitCode = 1;
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : 'Golden evaluation failed'}\n`);
        process.exitCode = 1;
    });
}
