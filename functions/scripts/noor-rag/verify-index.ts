import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

import type { NoorSource } from '../../src/noor-rag/generatedContract';
import { EMBEDDING_DIMENSION } from '../../src/noor-rag/embedding';

export const LOCKED_PROJECT = 'qurannotes-9f7a1' as const;
export const LOCKED_CORPUS_VERSION = '2026-08-10-v1' as const;
export const LOCKED_SOURCES: readonly NoorSource[] = ['ibn_kathir_en_abridged', 'al_sadi_ar'];

export interface IndexOptions {
    project: typeof LOCKED_PROJECT;
    version: typeof LOCKED_CORPUS_VERSION;
}

export interface IndexProbeRequest extends IndexOptions {
    source: NoorSource;
    vector: readonly number[];
    limit: 1;
}

export interface IndexProbeResponse {
    count: number;
    corpusVersion: string | null;
    source: string | null;
}

export interface IndexProbe {
    query(request: IndexProbeRequest): Promise<IndexProbeResponse>;
}

export interface IndexVerificationResult {
    ready: boolean;
    exitCode: 0 | 1;
    checkedSources: NoorSource[];
}

interface SnapshotLike { data(): unknown }
interface VectorQueryLike { get(): Promise<{ docs: readonly SnapshotLike[] }> }
interface QueryLike {
    where(field: string, operator: '==', value: string): QueryLike;
    findNearest(options: Readonly<Record<string, unknown>>): VectorQueryLike;
}
interface FirestoreLike { collectionGroup(name: string): QueryLike }

function valueArgument(args: readonly string[], name: string): string | undefined {
    const prefix = `--${name}=`;
    return args.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

export function parseIndexArguments(args: readonly string[]): IndexOptions {
    const project = valueArgument(args, 'project');
    const version = valueArgument(args, 'version');
    if (project !== LOCKED_PROJECT) throw new Error(`Index verification requires --project=${LOCKED_PROJECT}`);
    if (version !== LOCKED_CORPUS_VERSION) throw new Error(`Index verification requires --version=${LOCKED_CORPUS_VERSION}`);
    const known = new Set([`--project=${project}`, `--version=${version}`]);
    const unknown = args.find(value => !known.has(value));
    if (unknown) throw new Error(`Unknown index verification argument: ${unknown}`);
    return { project: LOCKED_PROJECT, version: LOCKED_CORPUS_VERSION };
}

export function createDeterministicProbeVector(): number[] {
    return Array.from({ length: EMBEDDING_DIMENSION }, (_value, index) => ((index % 17) + 1) / 17);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function verifyIndex(input: { options: IndexOptions; probe: IndexProbe }): Promise<IndexVerificationResult> {
    const checkedSources: NoorSource[] = [];
    const vector = createDeterministicProbeVector();
    try {
        for (const source of LOCKED_SOURCES) {
            const response = await input.probe.query({ ...input.options, source, vector, limit: 1 });
            checkedSources.push(source);
            if (response.count !== 1
                || response.corpusVersion !== input.options.version
                || response.source !== source) {
                return { ready: false, exitCode: 1, checkedSources };
            }
        }
        return { ready: true, exitCode: 0, checkedSources };
    } catch {
        return { ready: false, exitCode: 1, checkedSources };
    }
}

export async function createAdminIndexProbe(options: IndexOptions): Promise<IndexProbe> {
    const credential = applicationDefault();
    await credential.getAccessToken();
    const app = initializeApp({ credential, projectId: options.project }, `noor-index-${Date.now()}`);
    const firestore = getFirestore(app) as unknown as FirestoreLike;
    return {
        query: async request => {
            const snapshot = await firestore.collectionGroup('chunks')
                .where('corpusVersion', '==', request.version)
                .where('source', '==', request.source)
                .findNearest({
                    vectorField: 'embedding',
                    queryVector: FieldValue.vector([...request.vector]),
                    distanceMeasure: 'COSINE',
                    limit: request.limit,
                }).get();
            const data = snapshot.docs[0]?.data();
            return {
                count: snapshot.docs.length,
                corpusVersion: isRecord(data) && typeof data.corpusVersion === 'string' ? data.corpusVersion : null,
                source: isRecord(data) && typeof data.source === 'string' ? data.source : null,
            };
        },
    };
}

async function main(): Promise<void> {
    const options = parseIndexArguments(process.argv.slice(2));
    const result = await verifyIndex({ options, probe: await createAdminIndexProbe(options) });
    (result.ready ? process.stdout : process.stderr).write(result.ready ? 'ready\n' : 'not-ready\n');
    process.exitCode = result.exitCode;
}

if (require.main === module) {
    main().catch(() => {
        process.stderr.write('not-ready\n');
        process.exitCode = 1;
    });
}
