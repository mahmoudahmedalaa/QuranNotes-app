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
const ENTITY_SUMMARY_SIGNAL = /\b(?:main\s+themes?|themes?|summar(?:y|ize|ise)|overview|mainly\s+about|lessons?\s+(?:across|can\s+we\s+learn\s+from)|what\s+is\s+(?:this|the)\s+surah\s+about)\b/iu;

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

export function hasEntitySummarySignal(question: string): boolean {
    return ENTITY_SUMMARY_SIGNAL.test(normalizeName(question));
}
