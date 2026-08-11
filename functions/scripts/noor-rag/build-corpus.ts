import { GoogleGenAI } from '@google/genai';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    buildCorpus,
    loadReviewedCorpusInputs,
    promoteCorpusWithExactTokenCounts,
    serializeCorpusArtifact,
    type TokenCounter,
} from '../../src/noor-rag/corpus';
import {
    createVertexBatchTokenCounter,
} from '../../src/noor-rag/vertex-token-counter';

const GENERATION_MODEL = 'gemini-3.5-flash-lite';
const VERTEX_LOCATION = 'global';
const VERTEX_COUNTER_BATCH_SIZE = 32;
const VERTEX_COUNTER_CONCURRENCY = 2;
const VERTEX_COUNTER_TIMEOUT_MS = 30_000;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function argument(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length);
}

function localCounter(): TokenCounter {
    return {
        mode: 'local-deterministic',
        model: 'unicode-word-punctuation-v1',
        countTokens: async (text: string): Promise<number> => (
            text.match(/[\p{L}\p{M}\p{N}]+|[^\s]/gu)?.length ?? 0
        ),
    };
}

function vertexCounter(): TokenCounter {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION;
    if (!project || location !== VERTEX_LOCATION) {
        throw new Error(`Vertex counter mode requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION=${VERTEX_LOCATION}; refusing local approximation`);
    }
    const client = new GoogleGenAI({ vertexai: true, project, location });
    return createVertexBatchTokenCounter(
        client,
        GENERATION_MODEL,
        {
            batchSize: VERTEX_COUNTER_BATCH_SIZE,
            concurrency: VERTEX_COUNTER_CONCURRENCY,
            timeoutMs: VERTEX_COUNTER_TIMEOUT_MS,
        },
    );
}

function selectedMode(): 'local' | 'vertex' {
    const mode = argument('counter');
    if (mode === 'local' || mode === 'vertex') return mode;
    throw new Error('Explicit counter mode required: --counter=local or --counter=vertex');
}

async function main(): Promise<void> {
    const corpusVersion = argument('version');
    if (!corpusVersion || !VERSION_PATTERN.test(corpusVersion)) {
        throw new Error('A valid --version=<corpus-version> is required');
    }
    const repositoryRoot = resolve(__dirname, '../../../..');
    const functionsRoot = resolve(repositoryRoot, 'functions');
    const { sources } = loadReviewedCorpusInputs(repositoryRoot);
    const mode = selectedMode();
    const localArtifacts = await buildCorpus({
        corpusVersion,
        sources,
        tokenCounter: localCounter(),
    });
    const artifacts = mode === 'vertex'
        ? await promoteCorpusWithExactTokenCounts(localArtifacts, vertexCounter(), VERTEX_LOCATION)
        : localArtifacts;
    const outputDirectory = resolve(functionsRoot, '.generated/noor-corpus', corpusVersion);
    mkdirSync(outputDirectory, { recursive: true });
    writeFileSync(resolve(outputDirectory, 'units.json'), serializeCorpusArtifact(artifacts.units));
    writeFileSync(resolve(outputDirectory, 'chunks.json'), serializeCorpusArtifact(artifacts.chunks));
    writeFileSync(resolve(outputDirectory, 'lookups.json'), serializeCorpusArtifact(artifacts.lookups));
    writeFileSync(resolve(outputDirectory, 'manifest.json'), serializeCorpusArtifact(artifacts.manifest));
    process.stdout.write(`${serializeCorpusArtifact({
        outputDirectory,
        unitCount: artifacts.manifest.unitCount,
        chunkCount: artifacts.manifest.chunkCount,
        lookupCount: artifacts.manifest.lookupCount,
        aggregateSha256: artifacts.manifest.aggregateSha256,
        tokenizerMode: artifacts.manifest.tokenizerMode,
    })}`);
}

main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Unknown corpus build error'}\n`);
    process.exitCode = 1;
});
