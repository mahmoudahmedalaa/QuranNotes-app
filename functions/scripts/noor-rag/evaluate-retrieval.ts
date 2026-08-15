import type { NoorPolicyCategory } from '../../src/noor-rag/policy';
import type { NoorSanitizedTrace } from '../../src/noor-rag/handler';
import type { NoorAnswer } from '../../src/noor-rag/types';

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
    allowedStatuses?: readonly NoorAnswer['status'][];
}

export interface NoorExpectationResult {
    sampleCount: number;
    passed: boolean;
    contextSelectedCount: number;
    evidenceFoundCount: number;
    citationValidationPassedCount: number;
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

export function aggregateNoorEvaluation(input: Readonly<{
    traces: readonly NoorSanitizedTrace[];
    expectations?: Readonly<Record<string, NoorEvaluationExpectation>>;
}>): NoorRagEvaluationSummary {
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
        const statusesValid = expectation.allowedStatuses === undefined
            || selected.every(trace => expectation.allowedStatuses!.includes(trace.status));
        expectations[caseLabel] = {
            sampleCount: selected.length,
            passed: selected.length > 0
                && statusesValid
                && (expectation.minimumContextSelected === undefined || contextSelectedCount >= expectation.minimumContextSelected)
                && (expectation.minimumEvidenceFound === undefined || evidenceFoundCount >= expectation.minimumEvidenceFound)
                && (expectation.minimumCitationValidationPassed === undefined || citationValidationPassedCount >= expectation.minimumCitationValidationPassed),
            contextSelectedCount,
            evidenceFoundCount,
            citationValidationPassedCount,
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
