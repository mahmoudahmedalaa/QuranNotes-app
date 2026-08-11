import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    LOCKED_CORPUS_VERSION,
    LOCKED_PROJECT,
    configureRuntime,
    parseRuntimeArguments,
    type RuntimeConfigRepository,
} from '../../scripts/noor-rag/configure-runtime';

const DARK_CONFIG = {
    enabled: false,
    publicEnabled: false,
    ownerUids: [],
    activeCorpusVersion: 'none',
    promptVersion: 'noor-prompt-v1',
    generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
    pseudonymKeyVersion: 'hmac-v1',
    sourceThresholds: { ibn_kathir_en_abridged: 0.72, al_sadi_ar: 0.76 },
    maxChunksPerSource: 4,
    maxEvidenceCharacters: 24000,
} as const;

class FakeRepository implements RuntimeConfigRepository {
    readonly writes: unknown[] = [];
    constructor(readonly current: unknown | null) {}
    async read(): Promise<unknown | null> { return this.current; }
    async compareAndSet(_expected: unknown | null, next: unknown): Promise<void> { this.writes.push(next); }
}

describe('Noor runtime configuration', () => {
    it('requires locked project/version and an explicit safe mode', () => {
        assert.throws(() => parseRuntimeArguments([]), /project/);
        assert.throws(() => parseRuntimeArguments([`--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`]), /mode/);
        assert.throws(() => parseRuntimeArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
            '--initialize-disabled', '--expected-missing', '--public',
        ]), /one mode/);
    });

    it('bootstraps only the complete reviewed dark schema and defaults to zero writes', async () => {
        const repository = new FakeRepository(null);
        const options = parseRuntimeArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
            '--initialize-disabled', '--expected-missing',
        ]);
        const result = await configureRuntime({ options, repository, reviewedConfig: DARK_CONFIG });
        assert.equal(result.dryRun, true);
        assert.deepEqual(result.next, DARK_CONFIG);
        assert.deepEqual(repository.writes, []);
        assert.deepEqual(Object.keys(result.next).sort(), Object.keys(DARK_CONFIG).sort());
        assert.equal(JSON.stringify(result.next).includes('secret'), false);
    });

    it('writes the full strict schema only with the explicit production-write flag', async () => {
        const repository = new FakeRepository(null);
        const options = parseRuntimeArguments([
            `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
            '--initialize-disabled', '--expected-missing', '--execute-production-write',
        ]);
        const result = await configureRuntime({ options, repository, reviewedConfig: DARK_CONFIG });
        assert.equal(result.dryRun, false);
        assert.deepEqual(repository.writes, [DARK_CONFIG]);
    });

    it('preserves the exact schema while making owner-only, public, or disabled CAS updates', async () => {
        const ownerRepository = new FakeRepository(DARK_CONFIG);
        const owner = await configureRuntime({
            options: parseRuntimeArguments([
                `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
                '--owner-only', '--owner-uid=owner_B', '--owner-uid=owner_A', '--owner-uid=owner_A',
                '--expected-enabled=false', '--expected-public=false',
            ]),
            repository: ownerRepository,
            reviewedConfig: DARK_CONFIG,
        });
        assert.deepEqual(owner.next.ownerUids, ['owner_A', 'owner_B']);
        assert.equal(owner.next.enabled, true);
        assert.equal(owner.next.publicEnabled, false);
        assert.ok(owner.ownerProof.every(value => !value.includes('owner_A') && !value.includes('owner_B')));

        const publicResult = await configureRuntime({
            options: parseRuntimeArguments([
                `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
                '--public', '--expected-enabled=true', '--expected-public=false',
            ]),
            repository: new FakeRepository(owner.next),
            reviewedConfig: DARK_CONFIG,
        });
        assert.equal(publicResult.next.publicEnabled, true);

        const disabled = await configureRuntime({
            options: parseRuntimeArguments([
                `--project=${LOCKED_PROJECT}`, `--version=${LOCKED_CORPUS_VERSION}`,
                '--disabled', '--expected-enabled=true', '--expected-public=true',
            ]),
            repository: new FakeRepository(publicResult.next),
            reviewedConfig: DARK_CONFIG,
        });
        assert.equal(disabled.next.enabled, false);
        assert.equal(disabled.next.publicEnabled, false);
    });
});
