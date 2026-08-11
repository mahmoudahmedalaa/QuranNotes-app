import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { parseNoorRuntimeConfig, type NoorRuntimeConfig } from '../../src/noor-rag/config';
import { LOCKED_CORPUS_VERSION, LOCKED_PROJECT } from './verify-index';

export { LOCKED_CORPUS_VERSION, LOCKED_PROJECT };

type RuntimeMode = 'initialize-disabled' | 'owner-only' | 'public' | 'disabled';

export interface RuntimeOptions {
    project: typeof LOCKED_PROJECT;
    version: typeof LOCKED_CORPUS_VERSION;
    mode: RuntimeMode;
    execute: boolean;
    expectedMissing: boolean;
    expectedEnabled?: boolean;
    expectedPublic?: boolean;
    ownerUids: string[];
    configPath: string;
}

export interface RuntimeConfigRepository {
    read(): Promise<unknown | null>;
    compareAndSet(expected: unknown | null, next: NoorRuntimeConfig): Promise<void>;
}

const UID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const REVIEWED_CONFIG_PATH = 'docs/noor-rag/runtime-config.2026-08-10-v1.json';

function values(args: readonly string[], name: string): string[] {
    const prefix = `--${name}=`;
    return args.filter(value => value.startsWith(prefix)).map(value => value.slice(prefix.length));
}

function oneValue(args: readonly string[], name: string): string | undefined {
    const matches = values(args, name);
    if (matches.length > 1) throw new Error(`Duplicate --${name} argument`);
    return matches[0];
}

function booleanArgument(args: readonly string[], name: string): boolean | undefined {
    const value = oneValue(args, name);
    if (value === undefined) return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`--${name} must be true or false`);
}

export function parseRuntimeArguments(args: readonly string[]): RuntimeOptions {
    const project = oneValue(args, 'project');
    const version = oneValue(args, 'version');
    if (project !== LOCKED_PROJECT) throw new Error(`Runtime configuration requires --project=${LOCKED_PROJECT}`);
    if (version !== LOCKED_CORPUS_VERSION) throw new Error(`Runtime configuration requires --version=${LOCKED_CORPUS_VERSION}`);
    const modes = (['initialize-disabled', 'owner-only', 'public', 'disabled'] as const).filter(mode => args.includes(`--${mode}`));
    if (modes.length === 0) throw new Error('Runtime configuration requires an explicit mode');
    if (modes.length !== 1) throw new Error('Runtime configuration requires exactly one mode');
    const mode = modes[0];
    const expectedMissing = args.includes('--expected-missing');
    const expectedEnabled = booleanArgument(args, 'expected-enabled');
    const expectedPublic = booleanArgument(args, 'expected-public');
    const ownerUids = [...new Set(values(args, 'owner-uid'))].sort();
    if (ownerUids.some(uid => !UID.test(uid))) throw new Error('Invalid owner UID');
    if (mode === 'initialize-disabled') {
        if (!expectedMissing || expectedEnabled !== undefined || expectedPublic !== undefined || ownerUids.length > 0) {
            throw new Error('Disabled initialization requires only --expected-missing');
        }
    } else {
        if (expectedMissing || expectedEnabled === undefined || expectedPublic === undefined) {
            throw new Error('Runtime update requires expected enabled/public values');
        }
        if (mode === 'owner-only' && ownerUids.length === 0) throw new Error('Owner-only mode requires at least one owner UID');
        if (mode !== 'owner-only' && ownerUids.length > 0) throw new Error('Owner UIDs are permitted only in owner-only mode');
    }
    const configPath = oneValue(args, 'config') ?? REVIEWED_CONFIG_PATH;
    const recognized = new Set([
        `--project=${project}`, `--version=${version}`, `--${mode}`,
        ...(args.includes('--execute-production-write') ? ['--execute-production-write'] : []),
        ...(expectedMissing ? ['--expected-missing'] : []),
        ...(expectedEnabled === undefined ? [] : [`--expected-enabled=${String(expectedEnabled)}`]),
        ...(expectedPublic === undefined ? [] : [`--expected-public=${String(expectedPublic)}`]),
        ...values(args, 'owner-uid').map(uid => `--owner-uid=${uid}`),
        ...(oneValue(args, 'config') === undefined ? [] : [`--config=${configPath}`]),
    ]);
    const unknown = args.find(value => !recognized.has(value));
    if (unknown) throw new Error(`Unknown runtime configuration argument: ${unknown}`);
    return {
        project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION, mode,
        execute: args.includes('--execute-production-write'), expectedMissing,
        expectedEnabled, expectedPublic, ownerUids, configPath,
    };
}

function assertReviewedDarkConfig(value: unknown): NoorRuntimeConfig {
    const config = parseNoorRuntimeConfig(value);
    if (config.enabled || config.publicEnabled || config.ownerUids.length > 0 || config.activeCorpusVersion !== 'none') {
        throw new Error('Reviewed bootstrap config must be disabled, private, owner-empty, and inactive');
    }
    return config;
}

function same(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function ownerProof(uid: string): string {
    const suffix = uid.slice(-4);
    return `...${suffix} sha256:${createHash('sha256').update(uid).digest('hex').slice(0, 12)}`;
}

export async function configureRuntime(input: {
    options: RuntimeOptions;
    repository: RuntimeConfigRepository;
    reviewedConfig: unknown;
}): Promise<{ dryRun: boolean; next: NoorRuntimeConfig; ownerProof: string[] }> {
    const reviewed = assertReviewedDarkConfig(input.reviewedConfig);
    const currentValue = await input.repository.read();
    let expected: unknown | null;
    let next: NoorRuntimeConfig;
    if (input.options.mode === 'initialize-disabled') {
        if (currentValue !== null) throw new Error('Runtime config already exists');
        expected = null;
        next = reviewed;
    } else {
        if (currentValue === null) throw new Error('Runtime config is missing');
        const current = parseNoorRuntimeConfig(currentValue);
        if (current.enabled !== input.options.expectedEnabled || current.publicEnabled !== input.options.expectedPublic) {
            throw new Error('Runtime config compare-and-set expectation failed');
        }
        expected = current;
        if (input.options.mode === 'owner-only') {
            next = parseNoorRuntimeConfig({ ...current, enabled: true, publicEnabled: false, ownerUids: input.options.ownerUids });
        } else if (input.options.mode === 'public') {
            next = parseNoorRuntimeConfig({ ...current, enabled: true, publicEnabled: true });
        } else {
            next = parseNoorRuntimeConfig({ ...current, enabled: false, publicEnabled: false });
        }
    }
    if (input.options.execute) await input.repository.compareAndSet(expected, next);
    return { dryRun: !input.options.execute, next, ownerProof: next.ownerUids.map(ownerProof) };
}

async function createRepository(options: RuntimeOptions): Promise<RuntimeConfigRepository> {
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: options.project }, `noor-runtime-${Date.now()}`);
    const firestore = getFirestore(app);
    const reference = firestore.doc('noorConfig/runtime');
    return {
        read: async () => {
            const snapshot = await reference.get();
            return snapshot.exists ? snapshot.data() ?? null : null;
        },
        compareAndSet: async (expected, next) => firestore.runTransaction(async transaction => {
            const snapshot = await transaction.get(reference);
            const current = snapshot.exists ? snapshot.data() ?? null : null;
            if (!same(current, expected)) throw new Error('Runtime config changed during compare-and-set');
            transaction.set(reference, next, { merge: false });
        }),
    };
}

async function main(): Promise<void> {
    const options = parseRuntimeArguments(process.argv.slice(2));
    const repositoryRoot = resolve(__dirname, '../../../..');
    if (options.mode === 'public') {
        const provenance = JSON.parse(readFileSync(
            resolve(repositoryRoot, 'docs/noor-rag/corpus-provenance.json'), 'utf8',
        )) as unknown;
        if (typeof provenance !== 'object' || provenance === null
            || !('publicActivationApproved' in provenance)
            || provenance.publicActivationApproved !== true) {
            throw new Error('Corpus provenance public activation is not approved');
        }
    }
    const reviewedConfig = JSON.parse(readFileSync(resolve(repositoryRoot, options.configPath), 'utf8')) as unknown;
    const result = await configureRuntime({ options, repository: await createRepository(options), reviewedConfig });
    process.stdout.write(`${JSON.stringify({
        dryRun: result.dryRun,
        config: { ...result.next, ownerUids: result.ownerProof },
    }, undefined, 2)}\n`);
}

if (require.main === module) {
    main().catch((error: unknown) => {
        process.stderr.write(`${error instanceof Error ? error.message : 'Runtime configuration failed'}\n`);
        process.exitCode = 1;
    });
}
