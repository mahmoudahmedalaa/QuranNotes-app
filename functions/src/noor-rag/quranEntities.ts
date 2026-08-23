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
    'ayah', 'event', 'incident', 'mention', 'mentions', 'name', 'passage', 'people', 'person',
    'phrase', 'say', 'says', 'teach', 'teaches', 'verse', 'word',
]);
const LOCAL_EXPLANATION_TOKENS = new Set(['happen', 'happened', 'happens', 'how', 'when', 'where', 'who', 'why']);
const POLAR_QUESTION_TOKENS = new Set(['can', 'could', 'did', 'does', 'has', 'have', 'is']);
const REFERENTIAL_TOKENS = new Set(['her', 'him', 'it', 'them', 'that', 'these', 'this', 'those']);

export interface QuranSurahEntity {
    entityType: 'surah';
    surahNumber: number;
    canonicalName: string;
    verseCount: number;
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

export function hasEntitySummarySignal(question: string): boolean {
    const normalized = normalizeName(question);
    const tokens = normalized.split(/\s+/u).filter(Boolean);
    const tokenSet = new Set(tokens);
    if (tokens.some(token => SPECIFIC_FOCUS_TOKENS.has(token)) || /\b\d{1,3}\s*:\s*\d{1,3}\b/u.test(question)) return false;
    const polarQuestion = POLAR_QUESTION_TOKENS.has(tokens[0] ?? '');
    if (polarQuestion && (tokenSet.has('theme') || tokenSet.has('themes'))) return false;
    const hasBroadOperation = tokens.some(token => BROAD_OPERATION_TOKENS.has(token));
    const hasBroadScope = tokens.some(token => BROAD_SCOPE_TOKENS.has(token));
    const wholeEntityAboutQuestion = tokens[0] === 'what'
        && tokenSet.has('about')
        && !tokenSet.has('say')
        && !tokens.some(token => REFERENTIAL_TOKENS.has(token));
    const explanatoryOperation = tokenSet.has('explain') || tokenSet.has('describe');
    const localExplanation = explanatoryOperation && tokens.some(token => LOCAL_EXPLANATION_TOKENS.has(token));
    if (localExplanation) return false;
    const broadExplanation = explanatoryOperation;
    return wholeEntityAboutQuestion
        || broadExplanation
        || (hasBroadOperation && (hasBroadScope || !polarQuestion));
}
