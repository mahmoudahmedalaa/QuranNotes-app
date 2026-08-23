import type { NoorAnswer } from './types';

export type OutcomeNormalizationReason = 'none' | 'abstention_language' | 'non_answer_citations_removed';

export interface NormalizedNoorOutcome {
    response: NoorAnswer;
    reason: OutcomeNormalizationReason;
}

export const CANONICAL_INSUFFICIENT_EVIDENCE = 'I could not find enough reliable tafsir evidence to answer that safely.';

const ABSTENTION_LANGUAGE = /\b(?:could\s+not|couldn't|cannot|can't|unable\s+to)\s+(?:find|locate|identify)\b.{0,100}\b(?:enough|sufficient|reliable)\b.{0,80}\b(?:evidence|tafsir|support)\b|\b(?:not|isn't|wasn't)\s+enough\b.{0,80}\b(?:evidence|tafsir|support)\b|\b(?:insufficient|inadequate)\b.{0,40}\b(?:evidence|tafsir|support)\b/iu;

export function containsAbstentionLanguage(answer: string): boolean {
    return ABSTENTION_LANGUAGE.test(answer.normalize('NFKC'));
}

export function normalizeNoorOutcome(response: NoorAnswer): NormalizedNoorOutcome {
    if (response.status === 'answered' && containsAbstentionLanguage(response.answer)) {
        return {
            response: {
                requestId: response.requestId,
                status: 'insufficient_evidence',
                answer: CANONICAL_INSUFFICIENT_EVIDENCE,
                citations: [],
            },
            reason: 'abstention_language',
        };
    }
    if (response.status !== 'answered' && response.citations.length > 0) {
        return { response: { ...response, citations: [] }, reason: 'non_answer_citations_removed' };
    }
    return { response, reason: 'none' };
}
