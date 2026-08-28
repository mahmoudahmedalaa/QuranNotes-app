import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
    REQUIRED_VERIFICATION_CORPUS_ARTIFACTS,
    VerificationCorpusPreflightError,
    materializeVerificationCorpus,
    preflightVerificationCorpus,
    type VerificationCorpusContract,
} from '../../scripts/noor-rag/verification-corpus';

function fixture(): { source: string; expected: VerificationCorpusContract } {
    const source = mkdtempSync(join(tmpdir(), 'noor-corpus-source-'));
    const values = { units: [{ id: 'unit' }], chunks: [{ id: 'chunk' }], lookups: [{ id: 'lookup' }] };
    const digest = (value: unknown) => createHash('sha256').update(`${JSON.stringify(value, undefined, 2)}\n`).digest('hex');
    const artifactSha256 = {
        units: digest(values.units), chunks: digest(values.chunks), lookups: digest(values.lookups),
    };
    const aggregateSha256 = createHash('sha256')
        .update((['chunks', 'lookups', 'units'] as const).map(name => `${name}.json\0${artifactSha256[name]}\n`).join(''))
        .digest('hex');
    const expected: VerificationCorpusContract = {
        corpusVersion: '2026-08-10-v1', unitCount: 1, chunkCount: 1, lookupCount: 1,
        artifactSha256, aggregateSha256,
    };
    const manifest = { ...expected };
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, 'units.json'), JSON.stringify(values.units, undefined, 2));
    writeFileSync(join(source, 'chunks.json'), JSON.stringify(values.chunks, undefined, 2));
    writeFileSync(join(source, 'lookups.json'), JSON.stringify(values.lookups, undefined, 2));
    writeFileSync(join(source, 'manifest.json'), JSON.stringify(manifest, undefined, 2));
    return { source, expected };
}

describe('Noor verification corpus preflight', () => {
    it('fails explicitly when any verifier artifact is missing', () => {
        const directory = mkdtempSync(join(tmpdir(), 'noor-corpus-missing-'));

        assert.throws(
            () => preflightVerificationCorpus(directory),
            (error: unknown) => error instanceof VerificationCorpusPreflightError
                && error.code === 'verification_corpus_missing'
                && error.missingPath?.endsWith('/units.json') === true,
        );
    });

    it('validates the manifest and materializes only the locked verifier artifact set', () => {
        const { source, expected } = fixture();
        const target = mkdtempSync(join(tmpdir(), 'noor-corpus-carrier-'));
        const result = materializeVerificationCorpus({ sourceDirectory: source, targetDirectory: target, expected });

        assert.equal(result.ready, true);
        assert.deepEqual(
            REQUIRED_VERIFICATION_CORPUS_ARTIFACTS.map(name => readFileSync(join(target, name), 'utf8')),
            REQUIRED_VERIFICATION_CORPUS_ARTIFACTS.map(name => readFileSync(join(source, name), 'utf8')),
        );
    });

    it('rejects a changed artifact even when the manifest still declares the old identity', () => {
        const { source, expected } = fixture();
        writeFileSync(join(source, 'units.json'), JSON.stringify([{ id: 'changed' }], undefined, 2));

        assert.throws(
            () => preflightVerificationCorpus(source, expected),
            /verification_corpus_mismatch/,
        );
    });
});
