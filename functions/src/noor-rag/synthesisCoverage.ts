import type { QuranSurahEntity } from './quranEntities';
import type { RetrievedEvidence } from './types';

export interface SynthesisCoverageRequirement {
    selectedEvidenceCount: number;
    availableCanonicalEvidenceUnits: number;
    availableCoveredRegions: number;
    availableSourceCount: number;
    availableConceptClusters: number;
    coveredEntityVerses: number;
    entityVerseCount: number;
    overlapVerseCount: number;
    minimumSubstantiveCitationUnits: number;
    minimumSubstantiveSummaryPoints: number;
    minimumCoveredRegions: number;
    minimumCoveredVerses: number;
    coveredRegions: readonly SynthesisCoveredRegion[];
}

export interface SynthesisCoveredRegion {
    id: string;
    start: number;
    end: number;
    evidenceIds: readonly string[];
}

export interface SynthesisEvidenceCapacity {
    canonicalUnits: number;
    positionalSections: number;
    conceptClusters: number;
    span: number;
    sourceCount: number;
    coveredEntityVerses: number;
    overlapVerseCount: number;
    coveredRegions: readonly SynthesisCoveredRegion[];
}

interface EvidenceInterval {
    start: number;
    end: number;
    evidenceId: string;
    selectedIndex: number;
}

function selectedIntervals(evidence: readonly RetrievedEvidence[]): EvidenceInterval[] {
    return evidence.map((item, selectedIndex) => ({
        start: item.chunk.verseStart,
        end: item.chunk.verseEnd,
        evidenceId: item.promptSourceId,
        selectedIndex,
    })).sort((left, right) => left.start - right.start || left.end - right.end || left.selectedIndex - right.selectedIndex);
}

function mergeIntervals(
    intervals: readonly EvidenceInterval[],
    mergeAdjacent: boolean,
): Array<{ start: number; end: number; evidence: EvidenceInterval[] }> {
    const merged: Array<{ start: number; end: number; evidence: EvidenceInterval[] }> = [];
    for (const interval of intervals) {
        const previous = merged.at(-1);
        if (previous === undefined || interval.start > previous.end + (mergeAdjacent ? 1 : 0)) {
            merged.push({ start: interval.start, end: interval.end, evidence: [interval] });
        } else {
            previous.end = Math.max(previous.end, interval.end);
            previous.evidence.push(interval);
        }
    }
    return merged;
}

function verseCount(intervals: readonly { start: number; end: number }[]): number {
    return intervals.reduce((total, interval) => total + interval.end - interval.start + 1, 0);
}

function conceptTokens(value: string): Set<string> {
    return new Set(value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean));
}

function conceptSimilarity(left: RetrievedEvidence, right: RetrievedEvidence): number {
    const leftTokens = conceptTokens(left.chunk.retrievalText);
    const rightTokens = conceptTokens(right.chunk.retrievalText);
    const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
    const union = new Set([...leftTokens, ...rightTokens]).size;
    return union === 0 ? 1 : intersection / union;
}

function conceptClusterCount(evidence: readonly RetrievedEvidence[]): number {
    const representatives: RetrievedEvidence[] = [];
    for (const item of evidence) {
        if (!representatives.some(representative => conceptSimilarity(item, representative) >= 0.9)) {
            representatives.push(item);
        }
    }
    return representatives.length;
}

export function describeSynthesisEvidenceCapacity(
    entity: QuranSurahEntity,
    evidence: readonly RetrievedEvidence[],
): SynthesisEvidenceCapacity {
    const intervals = selectedIntervals(evidence);
    const coverageUnion = mergeIntervals(intervals, true);
    const overlapRegions = mergeIntervals(intervals, false).map((region, index) => ({
        id: `R${index + 1}`,
        start: region.start,
        end: region.end,
        evidenceIds: region.evidence
            .sort((left, right) => left.selectedIndex - right.selectedIndex)
            .map(item => item.evidenceId),
    }));
    const rawCoveredVerses = verseCount(intervals);
    const coveredEntityVerses = Math.min(entity.verseCount, verseCount(coverageUnion));
    const starts = evidence.map(item => item.chunk.verseStart);
    return {
        canonicalUnits: new Set(evidence.map(item => item.chunk.canonicalUnitId)).size,
        positionalSections: new Set(evidence.map(item => Math.min(
            5,
            Math.floor((item.chunk.verseStart - 1) * 6 / entity.verseCount),
        ))).size,
        conceptClusters: conceptClusterCount(evidence),
        span: starts.length === 0 ? 0 : Math.max(...starts) - Math.min(...starts),
        sourceCount: new Set(evidence.map(item => item.chunk.source)).size,
        coveredEntityVerses,
        overlapVerseCount: Math.max(0, rawCoveredVerses - coveredEntityVerses),
        coveredRegions: overlapRegions,
    };
}

export function buildSynthesisCoverageRequirement(
    entity: QuranSurahEntity,
    evidence: readonly RetrievedEvidence[],
): SynthesisCoverageRequirement {
    const capacity = describeSynthesisEvidenceCapacity(entity, evidence);
    const availableUsefulUnits = Math.min(capacity.canonicalUnits, capacity.conceptClusters);
    const nearCompleteOverlapCollapsed = capacity.coveredRegions.length === 1
        && capacity.overlapVerseCount > 0
        && capacity.coveredEntityVerses / entity.verseCount >= 0.8;
    const targetSubstantiveSupport = nearCompleteOverlapCollapsed ? 2 : 3;
    const minimumSubstantiveCitationUnits = Math.min(
        availableUsefulUnits,
        targetSubstantiveSupport,
    );
    return {
        selectedEvidenceCount: evidence.length,
        availableCanonicalEvidenceUnits: capacity.canonicalUnits,
        availableCoveredRegions: capacity.coveredRegions.length,
        availableSourceCount: capacity.sourceCount,
        availableConceptClusters: capacity.conceptClusters,
        coveredEntityVerses: capacity.coveredEntityVerses,
        entityVerseCount: entity.verseCount,
        overlapVerseCount: capacity.overlapVerseCount,
        minimumSubstantiveCitationUnits,
        minimumSubstantiveSummaryPoints: minimumSubstantiveCitationUnits,
        minimumCoveredRegions: Math.min(3, capacity.coveredRegions.length),
        minimumCoveredVerses: nearCompleteOverlapCollapsed
            ? Math.ceil(capacity.coveredEntityVerses * 0.8)
            : 0,
        coveredRegions: capacity.coveredRegions,
    };
}

export function synthesisCoverageRequirementXml(requirement: SynthesisCoverageRequirement): string {
    return [
        '<synthesisCoverageRequirement>',
        `<minimumSubstantiveCitationUnits>${requirement.minimumSubstantiveCitationUnits}</minimumSubstantiveCitationUnits>`,
        `<minimumSubstantiveSummaryPoints>${requirement.minimumSubstantiveSummaryPoints}</minimumSubstantiveSummaryPoints>`,
        `<minimumCoveredRegions>${requirement.minimumCoveredRegions}</minimumCoveredRegions>`,
        `<minimumCoveredVerses>${requirement.minimumCoveredVerses}</minimumCoveredVerses>`,
        `<availableCanonicalEvidenceUnits>${requirement.availableCanonicalEvidenceUnits}</availableCanonicalEvidenceUnits>`,
        `<availableCoveredRegions>${requirement.availableCoveredRegions}</availableCoveredRegions>`,
        `<availableSourceCount>${requirement.availableSourceCount}</availableSourceCount>`,
        `<availableConceptClusters>${requirement.availableConceptClusters}</availableConceptClusters>`,
        `<coveredEntityVerses>${requirement.coveredEntityVerses}</coveredEntityVerses>`,
        `<entityVerseCount>${requirement.entityVerseCount}</entityVerseCount>`,
        `<overlapVerseCount>${requirement.overlapVerseCount}</overlapVerseCount>`,
        '<coveredRegionMap>',
        ...requirement.coveredRegions.map(region => (
            `<coveredRegion id="${region.id}" verseStart="${region.start}" verseEnd="${region.end}" evidenceIds="${region.evidenceIds.join(',')}"/>`
        )),
        '</coveredRegionMap>',
        '</synthesisCoverageRequirement>',
    ].join('');
}

function substantiveCitationSupport(
    answer: string,
    evidence: readonly RetrievedEvidence[],
): { evidence: RetrievedEvidence[]; points: number } {
    const evidenceById = new Map(evidence.map(item => [item.promptSourceId, item]));
    const cited: RetrievedEvidence[] = [];
    let points = 0;
    const marker = /\[(S[1-9][0-9]*(?:\s*,\s*S[1-9][0-9]*)*)\]/gu;
    let previousMarkerEnd = 0;
    for (const match of answer.matchAll(marker)) {
        const segment = answer.slice(previousMarkerEnd, match.index)
            .normalize('NFKC')
            .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
            .trim()
            .split(/\s+/u)
            .filter(token => token.length >= 2);
        const items = match[1]!.split(',')
            .map(id => evidenceById.get(id.trim()))
            .filter((item): item is RetrievedEvidence => item !== undefined);
        if (items.length > 0 && segment.length >= 3) {
            cited.push(...items);
            points += 1;
        }
        previousMarkerEnd = (match.index ?? 0) + match[0].length;
    }
    return { evidence: cited, points };
}

export function synthesisCoveragePassed(
    answer: string,
    evidence: readonly RetrievedEvidence[],
    requirement: SynthesisCoverageRequirement,
): boolean {
    const support = substantiveCitationSupport(answer, evidence);
    const citedUnits = new Set(support.evidence.map(item => item.chunk.canonicalUnitId)).size;
    const regionByEvidenceId = new Map(requirement.coveredRegions.flatMap(region => (
        region.evidenceIds.map(evidenceId => [evidenceId, region.id] as const)
    )));
    const citedRegions = new Set(support.evidence.flatMap(item => {
        const region = regionByEvidenceId.get(item.promptSourceId);
        return region === undefined ? [] : [region];
    })).size;
    const citedVerseCoverage = verseCount(mergeIntervals(selectedIntervals(support.evidence), true));
    return citedUnits >= requirement.minimumSubstantiveCitationUnits
        && support.points >= requirement.minimumSubstantiveSummaryPoints
        && citedRegions >= requirement.minimumCoveredRegions
        && citedVerseCoverage >= requirement.minimumCoveredVerses;
}
