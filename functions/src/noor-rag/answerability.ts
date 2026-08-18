import type { NoorRuntimeConfig } from './config';
import type { RetrievedEvidence } from './types';

const ANSWERABILITY_IGNORED_TOKENS = new Set([
    'a', 'about', 'an', 'and', 'are', 'but', 'can', 'could', 'describe', 'did', 'does', 'do',
    'explain', 'for', 'from', 'give', 'had', 'has', 'have', 'he', 'her', 'him', 'his', 'how',
    'in', 'is', 'islam', 'islamic', 'it', 'its', 'may', 'me', 'might', 'my', 'of', 'on', 'or',
    'our', 'passage', 'please', 'prophet', 'quran', 'question', 'regarding', 'say', 'she', 'should',
    'surah', 'tafsir', 'tell', 'the', 'their', 'them', 'they', 'this', 'to', 'us', 'verse', 'was',
    'we', 'were', 'what', "what's", 'why', 'will', 'with', 'would', 'you', 'your',
]);
const ANSWERABILITY_CONCEPTS = new Map<string, string>([
    ['importance', 'importance'],
    ['important', 'importance'],
    ['significance', 'importance'],
    ['significant', 'importance'],
    ['special', 'importance'],
    ['virtue', 'importance'],
    ['virtues', 'importance'],
    ['alternative', 'alternative'],
    ['alternatives', 'alternative'],
    ['instead', 'alternative'],
    ['option', 'alternative'],
    ['options', 'alternative'],
    ['trade', 'alternative'],
    ['trading', 'alternative'],
]);
const LATIN_TOKEN = /^[a-z'-]+$/;

function meaningfulQueryTokens(query: string): readonly string[] {
    return [...evidenceTokens(query)].filter(token => !ANSWERABILITY_IGNORED_TOKENS.has(token));
}

function evidenceTokens(value: string): Set<string> {
    return new Set(value
        .normalize('NFKC')
        .toLocaleLowerCase()
        .replace(/[^\p{L}\p{N}'-]+/gu, ' ')
        .split(/\s+/u)
        .filter(Boolean));
}

function consonantSignature(token: string): string | null {
    if (token.length < 3 || !LATIN_TOKEN.test(token)) return null;
    const signature = token
        .replace(/['-]/gu, '')
        .replace(/[aeiouy]/gu, '')
        .replace(/(.)\1+/gu, '$1');
    return signature.length >= 2 ? signature : null;
}

function hasCrossSpellingSubjectMatch(queryTokens: readonly string[], chunkTokens: ReadonlySet<string>): boolean {
    const evidenceSignatures = new Set([...chunkTokens].flatMap(token => {
        const signature = consonantSignature(token);
        const bare = token.replace(/['-]/gu, '');
        return signature === null || bare.length === 0
            ? []
            : [`${bare[0]}:${bare.at(-1)}:${signature}`];
    }));
    return queryTokens.some(token => {
        const signature = consonantSignature(token);
        const bare = token.replace(/['-]/gu, '');
        return signature !== null
            && bare.length > 0
            && evidenceSignatures.has(`${bare[0]}:${bare.at(-1)}:${signature}`);
    });
}

function hasDirectQuestionSupport(query: string, evidence: RetrievedEvidence): boolean {
    const queryTokens = meaningfulQueryTokens(query);
    if (queryTokens.length === 0) return false;
    const chunkTokens = evidenceTokens(evidence.chunk.retrievalText);
    const chunkConcepts = new Set([...chunkTokens].map(token => ANSWERABILITY_CONCEPTS.get(token) ?? token));
    const matchedTokens = queryTokens.filter(token => (
        chunkTokens.has(token)
        || chunkConcepts.has(ANSWERABILITY_CONCEPTS.get(token) ?? token)
        || hasCrossSpellingSubjectMatch([token], chunkTokens)
    ));
    const requiredMatches = Math.min(2, queryTokens.length);
    return new Set(matchedTokens.map(token => ANSWERABILITY_CONCEPTS.get(token) ?? token)).size >= requiredMatches;
}

function verseRangesOverlap(left: RetrievedEvidence, right: RetrievedEvidence): boolean {
    return left.chunk.surah === right.chunk.surah
        && left.chunk.verseStart <= right.chunk.verseEnd
        && right.chunk.verseStart <= left.chunk.verseEnd;
}

export function selectAnswerableEvidence(
    query: string,
    evidence: readonly RetrievedEvidence[],
    config: NoorRuntimeConfig,
): RetrievedEvidence[] {
    const directlySupported = evidence.filter(item => hasDirectQuestionSupport(query, item));
    if (directlySupported.length === 0) return [];
    const directIds = new Set(directlySupported.map(item => item.chunk.chunkId));
    return evidence.filter(item => {
        if (directIds.has(item.chunk.chunkId)) return true;
        if (item.kind !== 'semantic') return false;
        const threshold = config.sourceThresholds[item.chunk.source] ?? 1;
        return item.similarity >= threshold
            && directlySupported.some(direct => verseRangesOverlap(direct, item));
    });
}
