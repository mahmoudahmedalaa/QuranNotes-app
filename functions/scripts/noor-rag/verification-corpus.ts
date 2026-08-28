import { createHash } from 'node:crypto';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';

import type { CorpusArtifacts } from '../../src/noor-rag/corpus';

export const LOCKED_VERIFICATION_CORPUS_VERSION = '2026-08-10-v1' as const;
export const REQUIRED_VERIFICATION_CORPUS_ARTIFACTS = [
    'units.json',
    'chunks.json',
    'lookups.json',
    'manifest.json',
] as const;

export interface VerificationCorpusContract {
    corpusVersion: typeof LOCKED_VERIFICATION_CORPUS_VERSION;
    unitCount: number;
    chunkCount: number;
    lookupCount: number;
    artifactSha256: {
        units: string;
        chunks: string;
        lookups: string;
    };
    aggregateSha256: string;
}

// This is verifier metadata only. The corpus payload remains ignored and is copied into
// a local verification carrier from the canonical prepared-artifact source.
export const PROMOTED_VERIFICATION_CORPUS_CONTRACT: VerificationCorpusContract = {
    corpusVersion: LOCKED_VERIFICATION_CORPUS_VERSION,
    unitCount: 7_867,
    chunkCount: 9_057,
    lookupCount: 12_408,
    artifactSha256: {
        units: '29d54513663eed4bac1b289fa8485e5aed3d4a60e7dc2c5da8a63161335f79f3',
        chunks: 'b71d98e27bd69fcb8368788469705e817bd21c059d37d02daf8e7745dffcb866',
        lookups: 'f0f644c2e3fd574858df6a62a027fdd7b024759f083b0814f9050faaf78862ae',
    },
    aggregateSha256: 'f6efa40de7dfa052619232fdbc99b67e7d7a45f19bbacdee4c1947f639adbca5',
};

export interface VerificationCorpusPreflightResult {
    ready: true;
    directory: string;
    corpusVersion: typeof LOCKED_VERIFICATION_CORPUS_VERSION;
    requiredArtifacts: readonly string[];
    artifactPaths: Readonly<Record<string, string>>;
    artifacts: CorpusArtifacts;
    artifactSha256: VerificationCorpusContract['artifactSha256'];
    aggregateSha256: string;
}

export class VerificationCorpusPreflightError extends Error {
    readonly stage = 'corpus_preflight' as const;

    constructor(
        readonly code: 'verification_corpus_missing' | 'verification_corpus_invalid' | 'verification_corpus_mismatch',
        message: string,
        readonly missingPath?: string,
    ) {
        super(message);
        this.name = 'VerificationCorpusPreflightError';
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
    return `${JSON.stringify(value, undefined, 2)}\n`;
}

function sha256(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

function aggregateSha256(hashes: VerificationCorpusContract['artifactSha256']): string {
    return sha256((['chunks', 'lookups', 'units'] as const)
        .map(name => `${name}.json\0${hashes[name]}\n`)
        .join(''));
}

function readRequiredJson(directory: string, fileName: string): unknown {
    const filePath = resolve(directory, fileName);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        throw new VerificationCorpusPreflightError(
            'verification_corpus_missing',
            `verification_corpus_missing: ${filePath}`,
            filePath,
        );
    }
    try {
        return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
    } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : 'invalid JSON';
        throw new VerificationCorpusPreflightError(
            'verification_corpus_invalid',
            `verification_corpus_invalid: ${filePath}: ${detail.slice(0, 240)}`,
            filePath,
        );
    }
}

function assertArray(value: unknown, name: string): asserts value is unknown[] {
    if (!Array.isArray(value)) throw new VerificationCorpusPreflightError('verification_corpus_invalid', `verification_corpus_invalid: ${name} must be an array`);
}

function assertSha256(value: unknown, name: string): asserts value is string {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
        throw new VerificationCorpusPreflightError('verification_corpus_invalid', `verification_corpus_invalid: ${name} must be a SHA-256 digest`);
    }
}

export function preflightVerificationCorpus(
    directory: string,
    expected: VerificationCorpusContract = PROMOTED_VERIFICATION_CORPUS_CONTRACT,
): VerificationCorpusPreflightResult {
    const artifactValues = Object.fromEntries(
        REQUIRED_VERIFICATION_CORPUS_ARTIFACTS.map(fileName => [fileName, readRequiredJson(directory, fileName)]),
    ) as Record<string, unknown>;
    const manifest = artifactValues['manifest.json'];
    if (!isRecord(manifest)
        || manifest.corpusVersion !== LOCKED_VERIFICATION_CORPUS_VERSION
        || manifest.corpusVersion !== expected.corpusVersion
        || manifest.unitCount !== expected.unitCount
        || manifest.chunkCount !== expected.chunkCount
        || manifest.lookupCount !== expected.lookupCount
        || !isRecord(manifest.artifactSha256)) {
        throw new VerificationCorpusPreflightError('verification_corpus_mismatch', 'verification_corpus_mismatch: manifest identity does not match the promoted corpus contract');
    }

    const units = artifactValues['units.json'];
    const chunks = artifactValues['chunks.json'];
    const lookups = artifactValues['lookups.json'];
    assertArray(units, 'units.json');
    assertArray(chunks, 'chunks.json');
    assertArray(lookups, 'lookups.json');
    if (units.length !== expected.unitCount || chunks.length !== expected.chunkCount || lookups.length !== expected.lookupCount) {
        throw new VerificationCorpusPreflightError('verification_corpus_mismatch', 'verification_corpus_mismatch: artifact counts do not match the promoted corpus contract');
    }

    const artifactSha256 = {
        units: sha256(stableJson(units)),
        chunks: sha256(stableJson(chunks)),
        lookups: sha256(stableJson(lookups)),
    };
    for (const name of ['units', 'chunks', 'lookups'] as const) {
        assertSha256(manifest.artifactSha256[name], `manifest.artifactSha256.${name}`);
        if (artifactSha256[name] !== manifest.artifactSha256[name]
            || artifactSha256[name] !== expected.artifactSha256[name]) {
            throw new VerificationCorpusPreflightError('verification_corpus_mismatch', `verification_corpus_mismatch: ${name}.json hash does not match the promoted corpus contract`);
        }
    }
    assertSha256(manifest.aggregateSha256, 'manifest.aggregateSha256');
    const computedAggregateSha256 = aggregateSha256(artifactSha256);
    if (computedAggregateSha256 !== manifest.aggregateSha256 || computedAggregateSha256 !== expected.aggregateSha256) {
        throw new VerificationCorpusPreflightError('verification_corpus_mismatch', 'verification_corpus_mismatch: aggregate hash does not match the promoted corpus contract');
    }

    const artifactPaths = Object.fromEntries(
        REQUIRED_VERIFICATION_CORPUS_ARTIFACTS.map(fileName => [fileName, resolve(directory, fileName)]),
    );
    return {
        ready: true,
        directory: resolve(directory),
        corpusVersion: LOCKED_VERIFICATION_CORPUS_VERSION,
        requiredArtifacts: REQUIRED_VERIFICATION_CORPUS_ARTIFACTS,
        artifactPaths,
        artifacts: {
            units: units as CorpusArtifacts['units'],
            chunks: chunks as CorpusArtifacts['chunks'],
            lookups: lookups as CorpusArtifacts['lookups'],
            manifest: manifest as unknown as CorpusArtifacts['manifest'],
        },
        artifactSha256,
        aggregateSha256: computedAggregateSha256,
    };
}

export function materializeVerificationCorpus(input: {
    sourceDirectory: string;
    targetDirectory: string;
    expected?: VerificationCorpusContract;
}): VerificationCorpusPreflightResult {
    const source = preflightVerificationCorpus(input.sourceDirectory, input.expected);
    mkdirSync(input.targetDirectory, { recursive: true });
    for (const fileName of REQUIRED_VERIFICATION_CORPUS_ARTIFACTS) {
        copyFileSync(source.artifactPaths[fileName]!, join(input.targetDirectory, fileName));
    }
    return preflightVerificationCorpus(input.targetDirectory, input.expected);
}

export function prepareVerificationCarrier(input: {
    carrierRoot: string;
    sourceDirectory: string;
    expected?: VerificationCorpusContract;
}): VerificationCorpusPreflightResult {
    const expected = input.expected ?? PROMOTED_VERIFICATION_CORPUS_CONTRACT;
    const targetDirectory = resolve(
        input.carrierRoot,
        'functions',
        '.generated',
        'noor-corpus',
        expected.corpusVersion,
    );
    return materializeVerificationCorpus({
        sourceDirectory: input.sourceDirectory,
        targetDirectory,
        expected,
    });
}

function argument(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function main(): Promise<void> {
    const sourceDirectory = argument('source') ?? resolve(__dirname, '../../../.generated/noor-corpus', LOCKED_VERIFICATION_CORPUS_VERSION);
    const carrierRoot = argument('carrier');
    const result = carrierRoot
        ? prepareVerificationCarrier({ carrierRoot, sourceDirectory })
        : preflightVerificationCorpus(sourceDirectory);
    process.stdout.write(`${JSON.stringify({
        verificationCorpus: {
            ready: result.ready,
            corpusVersion: result.corpusVersion,
            requiredArtifacts: result.requiredArtifacts,
            artifactSha256: result.artifactSha256,
            aggregateSha256: result.aggregateSha256,
        },
    })}\n`);
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : 'verification_corpus_preflight_failed'}\n`);
        process.exitCode = 1;
    });
}
