import { readFileSync } from 'node:fs';

import type { NoorEvaluationExpectation } from './evaluate-retrieval';

const MAX_CASES = 100;
const MAX_VARIANTS_PER_CASE = 20;
const MAX_TURNS_PER_VARIANT = 6;
const MAX_TURN_CHARACTERS = 500;
const LABEL_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const VALID_STATUSES = new Set(['answered', 'insufficient_evidence', 'policy_refusal', 'temporarily_unavailable']);

export interface NoorEvaluationVariant {
    turns: readonly string[];
}

export interface NoorEvaluationCase {
    id: string;
    family: string;
    variants: readonly NoorEvaluationVariant[];
    expected: NoorEvaluationExpectation;
}

export interface NoorEvaluationManifest {
    schemaVersion: 1;
    cases: readonly NoorEvaluationCase[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireLabel(value: unknown, field: string): string {
    if (typeof value !== 'string' || !LABEL_PATTERN.test(value)) {
        throw new Error(`Invalid evaluation ${field}`);
    }
    return value;
}

function parseExpected(value: unknown): NoorEvaluationExpectation {
    if (!isRecord(value) || !Array.isArray(value.allowedStatuses) || value.allowedStatuses.length === 0) {
        throw new Error('Evaluation case expected.allowedStatuses is required');
    }
    const allowedStatuses = value.allowedStatuses.filter((status): status is string => typeof status === 'string');
    if (allowedStatuses.length !== value.allowedStatuses.length || !allowedStatuses.every(status => VALID_STATUSES.has(status))) {
        throw new Error('Invalid evaluation allowed status');
    }
    const output: NoorEvaluationExpectation = { allowedStatuses: allowedStatuses as NoorEvaluationExpectation['allowedStatuses'] };
    for (const key of [
        'minimumContextSelected', 'minimumEvidenceFound', 'minimumCitationValidationPassed',
        'minimumLexicalAvailable', 'maximumLexicalUnavailable',
    ] as const) {
        const candidate = value[key];
        if (candidate !== undefined && (!Number.isSafeInteger(candidate) || (candidate as number) < 0)) {
            throw new Error(`Invalid evaluation expectation: ${key}`);
        }
        if (candidate !== undefined) output[key] = candidate as number;
    }
    return output;
}

function parseVariant(value: unknown): NoorEvaluationVariant {
    if (!isRecord(value) || !Array.isArray(value.turns) || value.turns.length === 0 || value.turns.length > MAX_TURNS_PER_VARIANT) {
        throw new Error('Evaluation variant turns are invalid');
    }
    const turns = value.turns.map(turn => {
        if (typeof turn !== 'string' || turn.trim().length === 0 || [...turn].length > MAX_TURN_CHARACTERS) {
            throw new Error('Evaluation turn is invalid');
        }
        return turn;
    });
    return { turns };
}

export function parseNoorEvaluationManifest(value: unknown): NoorEvaluationManifest {
    if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.cases)
        || value.cases.length === 0 || value.cases.length > MAX_CASES) {
        throw new Error('Noor evaluation manifest schemaVersion or cases are invalid');
    }
    const ids = new Set<string>();
    const cases = value.cases.map(item => {
        if (!isRecord(item)) throw new Error('Evaluation case is invalid');
        const id = requireLabel(item.id, 'case id');
        if (ids.has(id)) throw new Error(`Duplicate evaluation case: ${id}`);
        ids.add(id);
        const family = requireLabel(item.family, 'family');
        if (!Array.isArray(item.variants) || item.variants.length === 0 || item.variants.length > MAX_VARIANTS_PER_CASE) {
            throw new Error(`Evaluation case variants are invalid: ${id}`);
        }
        return { id, family, variants: item.variants.map(parseVariant), expected: parseExpected(item.expected) };
    });
    return { schemaVersion: 1, cases };
}

export function buildNoorEvaluationExpectations(
    manifest: NoorEvaluationManifest,
): Readonly<Record<string, NoorEvaluationExpectation>> {
    return Object.fromEntries(manifest.cases.map(item => [item.id, item.expected]));
}

function argument(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length);
}

function main(): void {
    const inputPath = argument('input');
    if (!inputPath) throw new Error('Evaluation manifest validation requires --input=<manifest-path>');
    const manifest = parseNoorEvaluationManifest(JSON.parse(readFileSync(inputPath, 'utf8')) as unknown);
    process.stdout.write(`${JSON.stringify({ schemaVersion: manifest.schemaVersion, caseCount: manifest.cases.length, families: [...new Set(manifest.cases.map(item => item.family))] }, undefined, 2)}\n`);
}

if (require.main === module) {
    try {
        main();
    } catch (error: unknown) {
        process.stderr.write(`${error instanceof Error ? error.message : 'Evaluation manifest validation failed'}\n`);
        process.exitCode = 1;
    }
}
