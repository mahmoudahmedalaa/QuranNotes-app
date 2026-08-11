import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
    loadReviewedCorpusInputs,
    serializeCorpusArtifact,
    validateCorpus,
    type CorpusArtifacts,
    type TokenCounter,
} from '../../src/noor-rag/corpus';

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

function readJson(path: string): unknown {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function readArtifacts(directory: string): CorpusArtifacts {
    const units = readJson(resolve(directory, 'units.json'));
    const chunks = readJson(resolve(directory, 'chunks.json'));
    const lookups = readJson(resolve(directory, 'lookups.json'));
    const manifest = readJson(resolve(directory, 'manifest.json'));
    if (!Array.isArray(units) || !Array.isArray(chunks) || !Array.isArray(lookups)
        || typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
        throw new Error('Generated corpus artifacts have invalid top-level shapes');
    }
    return { units, chunks, lookups, manifest } as CorpusArtifacts;
}

async function main(): Promise<void> {
    const corpusVersion = argument('version');
    const counterMode = argument('counter');
    if (!corpusVersion || !VERSION_PATTERN.test(corpusVersion)) {
        throw new Error('A valid --version=<corpus-version> is required');
    }
    if (counterMode !== 'local') {
        throw new Error('Explicit validator counter required; only --counter=local is available before credentialed production validation');
    }
    const repositoryRoot = resolve(__dirname, '../../../..');
    const functionsRoot = resolve(repositoryRoot, 'functions');
    const { coverage } = loadReviewedCorpusInputs(repositoryRoot);
    const directory = resolve(functionsRoot, '.generated/noor-corpus', corpusVersion);
    const artifacts = readArtifacts(directory);
    const errors = await validateCorpus(artifacts, coverage, localCounter());
    if (errors.length > 0) {
        throw new Error(`Corpus validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
    }
    process.stdout.write(serializeCorpusArtifact({
        valid: true,
        unitCount: artifacts.manifest.unitCount,
        chunkCount: artifacts.manifest.chunkCount,
        lookupCount: artifacts.manifest.lookupCount,
        aggregateSha256: artifacts.manifest.aggregateSha256,
    }));
}

main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'Unknown corpus validation error'}\n`);
    process.exitCode = 1;
});
