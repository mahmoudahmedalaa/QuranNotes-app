import type { NoorSanitizedTrace } from '../../src/noor-rag/handler';

export interface NoorRagEvaluationSummary {
    case: 'riba-followup';
    sampleCount: number;
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
}

export interface NoorLatencySummary {
    minimum: number;
    maximum: number;
    p50: number;
    p95: number;
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

export function aggregateRibaFollowUpEvaluation(
    traces: readonly NoorSanitizedTrace[],
): NoorRagEvaluationSummary {
    const sampleCount = traces.length;
    const stage = (name: keyof NoorSanitizedTrace['stageMs']): NoorLatencySummary => summarizeLatency(
        traces.map(trace => trace.stageMs[name]),
    );
    const queryCounts = traces.map(trace => trace.queryVariantCount);
    return {
        case: 'riba-followup',
        sampleCount,
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
    };
}
