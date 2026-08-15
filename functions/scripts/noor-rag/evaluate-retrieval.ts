import { readFileSync } from 'node:fs';

import type { NoorPolicyCategory } from '../../src/noor-rag/policy';
import type { NoorSanitizedTrace } from '../../src/noor-rag/handler';
import type { NoorAnswer } from '../../src/noor-rag/types';
import { buildNoorEvaluationExpectations, parseNoorEvaluationManifest } from './evaluation-cases';

export interface NoorLatencySummary {
    minimum: number;
    maximum: number;
    p50: number;
    p95: number;
}

export interface NoorEvaluationExpectation {
    minimumContextSelected?: number;
    minimumEvidenceFound?: number;
    minimumCitationValidationPassed?: number;
    minimumLexicalAvailable?: number;
    maximumLexicalUnavailable?: number;
    allowedStatuses?: readonly NoorAnswer['status'][];
}

export interface NoorExpectationResult {
    sampleCount: number;
    passed: boolean;
    contextSelectedCount: number;
    evidenceFoundCount: number;
    citationValidationPassedCount: number;
    lexicalAvailableCount: number;
    lexicalUnavailableCount: number;
}

export interface NoorRagEvaluationSummary {
    sampleCount: number;
    caseCounts: Record<string, number>;
    statusCounts: Partial<Record<NoorAnswer['status'], number>>;
    policyCounts: Partial<Record<NoorPolicyCategory, number>>;
    contextSelectedCount: number;
    evidenceFoundCount: number;
    generationNotRunCount: number;
    citationValidationPassedCount: number;
    lexicalAvailableCount: number;
    lexicalUnavailableCount: number;
    queryVariantCount: {
        total: number;
        minimum: number;
        maximum: number;
    };
    latencyMs: {
        policy: NoorLatencySummary;
        context: NoorLatencySummary;
        retrieval: NoorLatencySummary;
        generation: NoorLatencySummary;
        citationValidation: NoorLatencySummary;
    };
    expectations: Record<string, NoorExpectationResult>;
}

export interface NoorEvaluationInput {
    traces: readonly NoorSanitizedTrace[];
    expectations?: Readonly<Record<string, NoorEvaluationExpectation>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const TRACE_CASE_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const TRACE_STATUSES = new Set<NoorAnswer['status']>([
    'answered', 'insufficient_evidence', 'policy_refusal', 'not_entitled',
    'quota_exceeded', 'invalid_request', 'temporarily_unavailable',
]);
const TRACE_POLICIES = new Set<NoorPolicyCategory>([
    'allowed', 'personal_ruling', 'standalone_hadith', 'medical_legal_crisis',
    'prompt_injection', 'out_of_scope',
]);
const TRACE_QUERY_VARIANTS = new Set(['original', 'context_enriched']);
const TRACE_CONVERSATION_STATES = new Set(['validated_subject_and_evidence', 'none']);
const TRACE_LEXICAL_STATUSES = new Set(['available', 'unavailable', 'not_configured']);
const TRACE_GENERATION_STATUSES = new Set([...TRACE_STATUSES, 'not_run']);
const TRACE_CITATION_VALIDATION = new Set(['passed', 'failed', 'not_run']);
const MAX_TRACE_EVIDENCE = 8;
const MAX_TRACE_VARIANTS = 2;
const MAX_TRACE_DURATION_MS = 120_000;
const MAX_TRACE_COPY_CHARACTERS = 2_000;

function isBoundedInteger(value: unknown, maximum: number): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function isStringArray(value: unknown, maximum: number): value is string[] {
    return Array.isArray(value)
        && value.length <= maximum
        && value.every(item => typeof item === 'string' && item.length > 0 && item.length <= 256);
}

function isStageMs(value: unknown): value is NoorSanitizedTrace['stageMs'] {
    return isRecord(value)
        && ['policy', 'context', 'retrieval', 'generation', 'citationValidation'].every(name => (
            isBoundedInteger(value[name], MAX_TRACE_DURATION_MS)
        ));
}

function isSanitizedTrace(value: unknown): value is NoorSanitizedTrace {
    if (!isRecord(value)
        || typeof value.case !== 'string' || !TRACE_CASE_PATTERN.test(value.case)
        || typeof value.policy !== 'string' || !TRACE_POLICIES.has(value.policy as NoorPolicyCategory)
        || typeof value.status !== 'string' || !TRACE_STATUSES.has(value.status as NoorAnswer['status'])
        || !isBoundedInteger(value.citationCount, MAX_TRACE_EVIDENCE)
        || typeof value.conversationState !== 'string' || !TRACE_CONVERSATION_STATES.has(value.conversationState)
        || typeof value.contextSelected !== 'boolean'
        || !['validated_prior_subject', 'none'].includes(value.selectedPriorUserContext as string)
        || !isBoundedInteger(value.queryVariantCount, MAX_TRACE_VARIANTS)
        || !Array.isArray(value.queryVariantKinds)
        || value.queryVariantKinds.length !== value.queryVariantCount
        || !value.queryVariantKinds.every(item => typeof item === 'string' && TRACE_QUERY_VARIANTS.has(item))
        || new Set(value.queryVariantKinds).size !== value.queryVariantKinds.length
        || !isBoundedInteger(value.vectorHitCount, Number.MAX_SAFE_INTEGER)
        || !isBoundedInteger(value.lexicalHitCount, Number.MAX_SAFE_INTEGER)
        || typeof value.lexicalSearchStatus !== 'string' || !TRACE_LEXICAL_STATUSES.has(value.lexicalSearchStatus)
        || !isStringArray(value.evidenceIds, MAX_TRACE_EVIDENCE)
        || !isBoundedInteger(value.evidenceCount, MAX_TRACE_EVIDENCE)
        || value.evidenceIds.length > value.evidenceCount
        || typeof value.generationStatus !== 'string' || !TRACE_GENERATION_STATUSES.has(value.generationStatus)
        || typeof value.citationValidation !== 'string' || !TRACE_CITATION_VALIDATION.has(value.citationValidation)
        || !isStageMs(value.stageMs)
        || typeof value.finalCopy !== 'string'
        || value.finalCopy.length > MAX_TRACE_COPY_CHARACTERS) {
        return false;
    }
    return true;
}

function parseSanitizedTrace(value: unknown): NoorSanitizedTrace {
    if (!isSanitizedTrace(value)) throw new Error('Invalid sanitized trace');
    return value;
}

export function parseNoorEvaluationInput(value: unknown): NoorEvaluationInput {
    if (!isRecord(value) || !Array.isArray(value.traces)) {
        throw new Error('Noor evaluation input requires a traces array');
    }
    if (value.expectations !== undefined && !isRecord(value.expectations)) {
        throw new Error('Noor evaluation expectations must be an object');
    }
    return {
        traces: value.traces.map(parseSanitizedTrace),
        expectations: value.expectations as Readonly<Record<string, NoorEvaluationExpectation>> | undefined,
    };
}

function percentile(values: readonly number[], rank: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.ceil(rank * sorted.length) - 1);
    return sorted[index] ?? 0;
}

function summarizeLatency(values: readonly number[]): NoorLatencySummary {
    if (values.length === 0) return { minimum: 0, maximum: 0, p50: 0, p95: 0 };
    return {
        minimum: Math.min(...values),
        maximum: Math.max(...values),
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
    };
}

function increment<K extends string>(counts: Partial<Record<K, number>>, key: K): void {
    counts[key] = (counts[key] ?? 0) + 1;
}

export function aggregateNoorEvaluation(input: NoorEvaluationInput): NoorRagEvaluationSummary {
    const traces = input.traces;
    const caseCounts: Record<string, number> = {};
    const statusCounts: Partial<Record<NoorAnswer['status'], number>> = {};
    const policyCounts: Partial<Record<NoorPolicyCategory, number>> = {};
    for (const trace of traces) {
        increment(caseCounts, trace.case);
        increment(statusCounts, trace.status);
        increment(policyCounts, trace.policy);
    }
    const stage = (name: keyof NoorSanitizedTrace['stageMs']): NoorLatencySummary => summarizeLatency(
        traces.map(trace => trace.stageMs[name]),
    );
    const queryCounts = traces.map(trace => trace.queryVariantCount);
    const expectations: Record<string, NoorExpectationResult> = {};
    for (const [caseLabel, expectation] of Object.entries(input.expectations ?? {})) {
        const selected = traces.filter(trace => trace.case === caseLabel);
        const contextSelectedCount = selected.filter(trace => trace.contextSelected).length;
        const evidenceFoundCount = selected.filter(trace => trace.evidenceCount > 0).length;
        const citationValidationPassedCount = selected.filter(trace => trace.citationValidation === 'passed').length;
        const lexicalAvailableCount = selected.filter(trace => trace.lexicalSearchStatus === 'available').length;
        const lexicalUnavailableCount = selected.filter(trace => trace.lexicalSearchStatus === 'unavailable').length;
        const statusesValid = expectation.allowedStatuses === undefined
            || selected.every(trace => expectation.allowedStatuses!.includes(trace.status));
        expectations[caseLabel] = {
            sampleCount: selected.length,
            passed: selected.length > 0
                && statusesValid
                && (expectation.minimumContextSelected === undefined || contextSelectedCount >= expectation.minimumContextSelected)
                && (expectation.minimumEvidenceFound === undefined || evidenceFoundCount >= expectation.minimumEvidenceFound)
                && (expectation.minimumCitationValidationPassed === undefined || citationValidationPassedCount >= expectation.minimumCitationValidationPassed)
                && (expectation.minimumLexicalAvailable === undefined || lexicalAvailableCount >= expectation.minimumLexicalAvailable)
                && (expectation.maximumLexicalUnavailable === undefined || lexicalUnavailableCount <= expectation.maximumLexicalUnavailable),
            contextSelectedCount,
            evidenceFoundCount,
            citationValidationPassedCount,
            lexicalAvailableCount,
            lexicalUnavailableCount,
        };
    }
    return {
        sampleCount: traces.length,
        caseCounts,
        statusCounts,
        policyCounts,
        contextSelectedCount: traces.filter(trace => trace.contextSelected).length,
        evidenceFoundCount: traces.filter(trace => trace.evidenceCount > 0).length,
        generationNotRunCount: traces.filter(trace => trace.generationStatus === 'not_run').length,
        citationValidationPassedCount: traces.filter(trace => trace.citationValidation === 'passed').length,
        lexicalAvailableCount: traces.filter(trace => trace.lexicalSearchStatus === 'available').length,
        lexicalUnavailableCount: traces.filter(trace => trace.lexicalSearchStatus === 'unavailable').length,
        queryVariantCount: {
            total: queryCounts.reduce((total, count) => total + count, 0),
            minimum: queryCounts.length > 0 ? Math.min(...queryCounts) : 0,
            maximum: Math.max(0, ...queryCounts),
        },
        latencyMs: {
            policy: stage('policy'),
            context: stage('context'),
            retrieval: stage('retrieval'),
            generation: stage('generation'),
            citationValidation: stage('citationValidation'),
        },
        expectations,
    };
}

function argument(name: string): string | undefined {
    const prefix = `--${name}=`;
    return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length);
}

function main(): void {
    const inputPath = argument('input');
    if (!inputPath) throw new Error('Noor evaluation requires --input=<sanitized-json-path>');
    const input = parseNoorEvaluationInput(JSON.parse(readFileSync(inputPath, 'utf8')) as unknown);
    const casesPath = argument('cases');
    const expectations = casesPath === undefined
        ? input.expectations
        : buildNoorEvaluationExpectations(parseNoorEvaluationManifest(JSON.parse(readFileSync(casesPath, 'utf8')) as unknown));
    process.stdout.write(`${JSON.stringify(aggregateNoorEvaluation({ ...input, expectations }), undefined, 2)}\n`);
}

if (require.main === module) {
    try {
        main();
    } catch (error: unknown) {
        process.stderr.write(`${error instanceof Error ? error.message : 'Noor evaluation failed'}\n`);
        process.exitCode = 1;
    }
}
