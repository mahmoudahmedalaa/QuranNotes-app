import { QURAN_VERSE_COUNTS } from './corpus';

const CANONICAL_SURAH_NAMES: readonly string[] = [
    'Al-Fatihah', 'Al-Baqarah', "Ali 'Imran", 'An-Nisa', "Al-Ma'idah", "Al-An'am", "Al-A'raf", 'Al-Anfal',
    'At-Tawbah', 'Yunus', 'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf',
    'Maryam', 'Ta-Ha', 'Al-Anbiya', 'Al-Hajj', "Al-Mu'minun", 'An-Nur', 'Al-Furqan', "Ash-Shu'ara", 'An-Naml',
    'Al-Qasas', 'Al-Ankabut', 'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin',
    'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir', 'Fussilat', 'Ash-Shuraa', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah',
    'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat', 'Qaf', 'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar',
    'Ar-Rahman', "Al-Waqi'ah", 'Al-Hadid', 'Al-Mujadila', 'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', "Al-Jumu'ah",
    'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim', 'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij",
    'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah', 'Al-Insan', 'Al-Mursalat', 'An-Naba',
    "An-Nazi'at", 'Abasa', 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin', 'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq',
    "Al-A'la", 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Layl', 'Ad-Duhaa', 'Ash-Sharh',
    'At-Tin', 'Al-Alaq', 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', 'Al-Adiyat', "Al-Qari'ah", 'At-Takathur',
    'Al-Asr', 'Al-Humazah', 'Al-Fil', 'Quraysh', "Al-Ma'un", 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr',
    'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas',
];

const ARTICLE_PATTERN = /^(?:ad|adh|al|an|ar|as|ash|at|az)\s+/u;
const BROAD_OPERATION_TOKENS = new Set([
    'convey', 'conveys', 'describe', 'explain', 'gist', 'learn', 'lesson', 'lessons',
    'message', 'overview', 'picture', 'summarise', 'summarize', 'summary', 'theme', 'themes',
    'understand', 'walk',
]);
const BROAD_SCOPE_TOKENS = new Set([
    'central', 'core', 'fundamentally', 'key', 'main', 'mainly', 'major', 'overall', 'whole',
]);
const SPECIFIC_FOCUS_TOKENS = new Set([
    'ayah', 'beginning', 'cause', 'character', 'ending', 'event', 'incident', 'mention', 'mentions', 'name',
    'passage', 'people', 'person', 'phrase', 'prison', 'reason', 'say', 'says', 'teach', 'teaches', 'verse', 'word',
]);
const POSITIVE_FOCUS_CUE_TOKENS = new Set(['especially', 'focus', 'focusing', 'specifically']);
const FOCUS_EXCLUSION_CUES: readonly (readonly string[])[] = [
    ['not'],
    ['without'],
    ['rather', 'than'],
    ['instead', 'of'],
];
const FOCUS_EXCLUSION_BOUNDARIES = new Set(['but', 'however', 'yet']);
const FOCUS_CLAUSE_BOUNDARY = '|';
const FOCUS_COMMA_BOUNDARY = '/';
const WHOLE_RANGE_START_TOKENS = new Set(['beginning', 'start']);
const WHOLE_RANGE_END_TOKENS = new Set(['end', 'ending', 'finish']);
const LOCAL_EXPLANATION_TOKENS = new Set(['happen', 'happened', 'happens', 'how', 'when', 'where', 'who', 'why']);
const POLAR_QUESTION_TOKENS = new Set([
    'are', 'can', 'could', 'did', 'do', 'does', 'has', 'have', 'is', 'should', 'was', 'were', 'will', 'would',
]);
const REFERENTIAL_TOKENS = new Set(['her', 'him', 'it', 'them', 'that', 'these', 'this', 'those']);
const COURTESY_FRAME_TOKENS = new Set(['me', 'please', 'pls', 'tell']);

export interface QuranSurahEntity {
    entityType: 'surah';
    surahNumber: number;
    canonicalName: string;
    verseCount: number;
}

export interface QuranSurahEntityCandidate {
    entity: QuranSurahEntity;
    matchKind: 'strict' | 'exact_alias' | 'fuzzy_transliteration';
    explicitSurahMarker: boolean;
}

interface SurahMatch {
    entity: QuranSurahEntity;
    alias: string;
    requiresMarker: boolean;
}

function normalizeName(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .toLocaleLowerCase()
        .replace(/[’'`-]+/gu, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/gu, ' ');
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function collapseRepeatedCharacters(value: string): string {
    return value.replace(/([\p{L}\p{N}])\1+/gu, '$1');
}

function editDistance(left: string, right: string): number {
    const previous = Array.from({ length: right.length + 1 }, (_value, index) => index);
    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];
        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
            current[rightIndex] = Math.min(
                (previous[rightIndex] ?? 0) + 1,
                (current[rightIndex - 1] ?? 0) + 1,
                (previous[rightIndex - 1] ?? 0) + substitutionCost,
            );
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[right.length] ?? Math.max(left.length, right.length);
}

const TRANSLITERATION_VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

function isSafeTransliterationEdit(left: string, right: string): boolean {
    if (left.length === right.length) {
        const mismatchIndex = [...left].findIndex((character, index) => character !== right[index]);
        if (mismatchIndex < 0) return false;
        if ([...left].filter((character, index) => character !== right[index]).length !== 1) return false;
        return TRANSLITERATION_VOWELS.has(left[mismatchIndex] ?? '')
            && TRANSLITERATION_VOWELS.has(right[mismatchIndex] ?? '');
    }
    const longer = left.length > right.length ? left : right;
    const shorter = left.length > right.length ? right : left;
    let shortIndex = 0;
    let inserted = '';
    let insertionIndex = -1;
    for (let longIndex = 0; longIndex < longer.length; longIndex += 1) {
        if (longer[longIndex] === shorter[shortIndex]) shortIndex += 1;
        else if (inserted.length === 0) {
            inserted = longer[longIndex] ?? '';
            insertionIndex = longIndex;
        } else return false;
    }
    if (inserted.length === 0) {
        inserted = longer.at(-1) ?? '';
        insertionIndex = longer.length - 1;
    }
    const trailingEnglishE = inserted === 'e' && insertionIndex === longer.length - 1;
    const terminalH = inserted === 'h' && insertionIndex === longer.length - 1;
    return terminalH || (TRANSLITERATION_VOWELS.has(inserted) && !trailingEnglishE);
}

function candidateSegments(value: string): string[] {
    const tokens = normalizeName(value).split(/\s+/u).filter(Boolean);
    const segments: string[] = [];
    for (let start = 0; start < tokens.length; start += 1) {
        for (let length = 1; length <= 3 && start + length <= tokens.length; length += 1) {
            segments.push(tokens.slice(start, start + length).join(' '));
        }
    }
    return segments;
}

export const QURAN_SURAHS: readonly QuranSurahEntity[] = CANONICAL_SURAH_NAMES.map((canonicalName, index) => {
    const verseCount = QURAN_VERSE_COUNTS[index];
    if (verseCount === undefined) throw new Error(`Missing verse count for surah ${index + 1}`);
    return { entityType: 'surah', surahNumber: index + 1, canonicalName, verseCount };
});

const SURAH_MATCHES: readonly SurahMatch[] = QURAN_SURAHS.flatMap(entity => {
    const canonicalAlias = normalizeName(entity.canonicalName);
    const withoutArticle = canonicalAlias.replace(ARTICLE_PATTERN, '');
    const aliases = withoutArticle === canonicalAlias ? [canonicalAlias] : [canonicalAlias, withoutArticle];
    return aliases.map(alias => ({
        entity,
        alias,
        requiresMarker: alias === withoutArticle && withoutArticle === canonicalAlias,
    }));
}).sort((left, right) => right.alias.length - left.alias.length || left.entity.surahNumber - right.entity.surahNumber);

export function canonicalSurahByNumber(surahNumber: number): QuranSurahEntity | null {
    return QURAN_SURAHS[surahNumber - 1] ?? null;
}

export function resolveQuranSurahEntity(value: string): QuranSurahEntity | null {
    const normalized = normalizeName(value);
    for (const match of SURAH_MATCHES) {
        const alias = escapeRegExp(match.alias);
        const explicit = new RegExp(`\\b(?:surah|surat)\\s+(?:${alias})\\b`, 'u').test(normalized);
        const implicit = !match.requiresMarker
            && new RegExp(`\\b${alias}\\b`, 'u').test(normalized);
        if (explicit || implicit) return match.entity;
    }
    return null;
}

export function resolveQuranSurahEntities(value: string): QuranSurahEntity[] {
    const normalized = normalizeName(value);
    const resolved: QuranSurahEntity[] = [];
    for (const match of SURAH_MATCHES) {
        const alias = escapeRegExp(match.alias);
        const explicit = new RegExp(`\\b(?:surah|surat)\\s+(?:${alias})\\b`, 'u').test(normalized);
        const implicit = !match.requiresMarker && new RegExp(`\\b${alias}\\b`, 'u').test(normalized);
        if ((explicit || implicit) && !resolved.some(entity => entity.surahNumber === match.entity.surahNumber)) {
            resolved.push(match.entity);
        }
    }
    return resolved;
}

/**
 * Finds a conservative canonical Surah candidate for ambiguous task planning.
 * Unlike the strict resolver, this may recognize an unmarked canonical name or
 * one single-edit spelling variation. Callers must not treat the candidate as
 * an explicit Surah scope until the request semantics establish whole-Surah intent.
 */
export function resolveQuranSurahEntityCandidateMatch(value: string): QuranSurahEntityCandidate | null {
    const strict = resolveQuranSurahEntity(value);
    const normalized = normalizeName(value);
    const markerGovernsAlias = (alias: string): boolean => (
        new RegExp(`\\b(?:surah|surat)\\s+(?:(?:ad|adh|al|an|ar|as|ash|at|az)\\s+)?${escapeRegExp(alias)}\\b`, 'u').test(normalized)
    );
    if (strict) {
        const explicitSurahMarker = SURAH_MATCHES.some(match => (
            match.entity.surahNumber === strict.surahNumber && markerGovernsAlias(match.alias)
        ));
        return { entity: strict, matchKind: 'strict', explicitSurahMarker };
    }
    const segments = candidateSegments(value);
    for (const match of SURAH_MATCHES) {
        if (segments.includes(match.alias)) {
            return {
                entity: match.entity,
                matchKind: 'exact_alias',
                explicitSurahMarker: markerGovernsAlias(match.alias),
            };
        }
    }
    const matches: Array<{
        entity: QuranSurahEntity;
        distance: number;
        aliasLength: number;
        explicitSurahMarker: boolean;
    }> = [];
    for (const segment of segments) {
        const collapsedSegment = collapseRepeatedCharacters(segment);
        if (segment.length < 4 || collapsedSegment.includes(' ')) continue;
        const explicitSurahMarker = markerGovernsAlias(segment);
        for (const match of SURAH_MATCHES) {
            if (match.alias.includes(' ')) continue;
            // Short one-edit matches are too collision-prone without an explicit
            // Surah marker (for example room/Rum, milk/Mulk, and faith/Fath).
            if (!explicitSurahMarker && (segment.length < 5 || match.alias.length < 5)) continue;
            const collapsedAlias = collapseRepeatedCharacters(match.alias);
            if (Math.abs(collapsedSegment.length - collapsedAlias.length) > 1) continue;
            const distance = editDistance(collapsedSegment, collapsedAlias);
            if (distance <= 1 && (distance === 0 || isSafeTransliterationEdit(collapsedSegment, collapsedAlias))) {
                matches.push({ entity: match.entity, distance, aliasLength: match.alias.length, explicitSurahMarker });
            }
        }
    }
    matches.sort((left, right) => left.distance - right.distance || right.aliasLength - left.aliasLength);
    const best = matches[0];
    if (!best) return null;
    const equallyGood = matches.filter(match => (
        match.distance === best.distance && match.aliasLength === best.aliasLength
    ));
    return equallyGood.every(match => match.entity.surahNumber === best.entity.surahNumber)
        ? {
            entity: best.entity,
            matchKind: 'fuzzy_transliteration',
            explicitSurahMarker: equallyGood.some(match => match.explicitSurahMarker),
        }
        : null;
}

export function resolveQuranSurahEntityCandidate(value: string): QuranSurahEntity | null {
    return resolveQuranSurahEntityCandidateMatch(value)?.entity ?? null;
}

function hasPolarQuestionFrame(tokens: readonly string[]): boolean {
    const subordinateIndex = tokens.findIndex(token => token === 'if' || token === 'whether');
    if (subordinateIndex >= 0
        && tokens.slice(subordinateIndex + 1).some(token => POLAR_QUESTION_TOKENS.has(token))) return true;
    let index = 0;
    while (COURTESY_FRAME_TOKENS.has(tokens[index] ?? '')) index += 1;
    const first = tokens[index] ?? '';
    const second = tokens[index + 1] ?? '';
    if (['can', 'could', 'will', 'would'].includes(first) && second === 'you') {
        let nestedIndex = index + 2;
        while (COURTESY_FRAME_TOKENS.has(tokens[nestedIndex] ?? '')) nestedIndex += 1;
        return POLAR_QUESTION_TOKENS.has(tokens[nestedIndex] ?? '');
    }
    return POLAR_QUESTION_TOKENS.has(first);
}

export function hasPolarQuestionSignal(question: string): boolean {
    return hasPolarQuestionFrame(normalizeName(question).split(/\s+/u).filter(Boolean));
}

export type PointFocusPolarity = 'none' | 'positive' | 'excluded' | 'mixed';

function cueMatchesAt(tokens: readonly string[], cue: readonly string[], start: number): boolean {
    return cue.every((token, offset) => tokens[start + offset] === token);
}

function firstFocusExclusionCueIndex(tokens: readonly string[]): number {
    return tokens.findIndex((_token, index) => FOCUS_EXCLUSION_CUES.some(cue => cueMatchesAt(tokens, cue, index)));
}

function focusScopeTokens(question: string): string[] {
    return question
        .normalize('NFKD')
        .replace(/\p{M}+/gu, '')
        .toLocaleLowerCase()
        .replace(/\bdon[’']t\b/gu, 'do not')
        .replace(/[.!?;:]+/gu, ` ${FOCUS_CLAUSE_BOUNDARY} `)
        .replace(/,+/gu, ` ${FOCUS_COMMA_BOUNDARY} `)
        .replace(/[’'`-]+/gu, ' ')
        .replace(/[^\p{L}\p{N}|/]+/gu, ' ')
        .trim()
        .split(/\s+/u)
        .filter(Boolean);
}

function wholeRangeFocusIndexes(tokens: readonly string[]): Set<number> {
    const indexes = new Set<number>();
    for (let index = 0; index < tokens.length; index += 1) {
        if (tokens[index] !== 'from') continue;
        let cursor = index + 1;
        if (tokens[cursor] === 'the') cursor += 1;
        if (!WHOLE_RANGE_START_TOKENS.has(tokens[cursor] ?? '')) continue;
        const startIndex = cursor;
        cursor += 1;
        if (tokens[cursor] !== 'to') continue;
        cursor += 1;
        if (tokens[cursor] === 'the') cursor += 1;
        if (!WHOLE_RANGE_END_TOKENS.has(tokens[cursor] ?? '')) continue;
        indexes.add(startIndex);
        indexes.add(cursor);
    }
    return indexes;
}

/**
 * Classifies bounded point-focus expressions by whether the user requests or excludes them.
 * Excluded focus must not veto an otherwise explicit whole-entity request.
 */
export function pointFocusPolarity(question: string): PointFocusPolarity {
    const tokens = focusScopeTokens(question);
    const wholeRangeIndexes = wholeRangeFocusIndexes(tokens);
    let positive = false;
    let excluded = false;
    let exclusionActive = false;
    let excludedFocusSeen = false;
    let positiveFocusMayFollowComma = false;
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index] ?? '';
        if (token === FOCUS_CLAUSE_BOUNDARY || FOCUS_EXCLUSION_BOUNDARIES.has(token)) {
            exclusionActive = false;
            excludedFocusSeen = false;
            positiveFocusMayFollowComma = false;
            continue;
        }
        if (token === FOCUS_COMMA_BOUNDARY) {
            positiveFocusMayFollowComma = exclusionActive && excludedFocusSeen;
            if (exclusionActive && !excludedFocusSeen) exclusionActive = false;
            continue;
        }
        if (positiveFocusMayFollowComma && POSITIVE_FOCUS_CUE_TOKENS.has(token)) {
            exclusionActive = false;
            excludedFocusSeen = false;
        }
        positiveFocusMayFollowComma = false;
        const exclusionCue = FOCUS_EXCLUSION_CUES.find(cue => cueMatchesAt(tokens, cue, index));
        if (exclusionCue) {
            exclusionActive = true;
            excludedFocusSeen = false;
            index += exclusionCue.length - 1;
            continue;
        }
        if (token === 'and' && POSITIVE_FOCUS_CUE_TOKENS.has(tokens[index + 1] ?? '')) {
            exclusionActive = false;
            excludedFocusSeen = false;
            continue;
        }
        if (!SPECIFIC_FOCUS_TOKENS.has(token) && !POSITIVE_FOCUS_CUE_TOKENS.has(token)) continue;
        if (wholeRangeIndexes.has(index)) continue;
        if (exclusionActive) {
            excluded = true;
            excludedFocusSeen = true;
        }
        else positive = true;
    }
    if (positive && excluded) return 'mixed';
    if (positive) return 'positive';
    if (excluded) return 'excluded';
    return 'none';
}

export function hasEntitySummarySignal(question: string): boolean {
    const normalized = normalizeName(question);
    const tokens = normalized.split(/\s+/u).filter(Boolean);
    const tokenSet = new Set(tokens);
    const focusPolarity = pointFocusPolarity(question);
    let semanticFrameStart = 0;
    while (COURTESY_FRAME_TOKENS.has(tokens[semanticFrameStart] ?? '')) semanticFrameStart += 1;
    const exclusionCueIndex = focusPolarity === 'excluded' ? firstFocusExclusionCueIndex(tokens) : -1;
    const semanticFrameEnd = exclusionCueIndex >= semanticFrameStart ? exclusionCueIndex : tokens.length;
    const semanticFrame = tokens.slice(semanticFrameStart, semanticFrameEnd).join(' ');
    if (focusPolarity === 'positive' || focusPolarity === 'mixed'
        || /\b\d{1,3}\s*:\s*\d{1,3}\b/u.test(question)) return false;
    const polarQuestion = hasPolarQuestionFrame(tokens);
    if (polarQuestion) return false;
    const hasBroadOperation = tokens.some(token => BROAD_OPERATION_TOKENS.has(token));
    const hasBroadScope = tokens.some(token => BROAD_SCOPE_TOKENS.has(token));
    const wholeEntityAboutQuestion = SURAH_MATCHES.some(match => (
        new RegExp(
            `^what\\s+(?:(?:is|s)\\s+(?:the\\s+)?(?:surah|surat)\\s+${escapeRegExp(match.alias)}`
                + `|(?:the\\s+)?(?:surah|surat)\\s+${escapeRegExp(match.alias)}\\s+(?:is|s))\\s+about$`,
            'u',
        ).test(semanticFrame)
    ))
        && !tokenSet.has('say')
        && !tokens.some(token => REFERENTIAL_TOKENS.has(token));
    const explicitWholeSurahAboutRequest = /\babout\s+(?:the\s+)?(?:surah|surat)\b/u.test(normalized)
        && !tokens.some(token => LOCAL_EXPLANATION_TOKENS.has(token));
    const explanatoryOperation = tokenSet.has('explain') || tokenSet.has('describe');
    const localExplanation = explanatoryOperation && tokens.some(token => LOCAL_EXPLANATION_TOKENS.has(token));
    if (localExplanation) return false;
    const broadExplanation = explanatoryOperation;
    return wholeEntityAboutQuestion
        || explicitWholeSurahAboutRequest
        || broadExplanation
        || (hasBroadOperation && (hasBroadScope || !polarQuestion));
}

export function hasWholeEntityScopeSignal(question: string): boolean {
    const normalized = normalizeName(question);
    const tokens = normalized.split(/\s+/u).filter(Boolean);
    const focusPolarity = pointFocusPolarity(question);
    if (focusPolarity === 'positive' || focusPolarity === 'mixed'
        || /\b\d{1,3}\s*:\s*\d{1,3}\b/u.test(question)) return false;
    if (hasPolarQuestionFrame(tokens)) return false;
    return tokens.some(token => BROAD_SCOPE_TOKENS.has(token));
}
