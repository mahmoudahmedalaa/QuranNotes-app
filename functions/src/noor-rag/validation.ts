import type {
    NoorAnswer,
    NoorCitation,
    NoorHistoryTurn,
    NoorRequest,
    NoorSource,
    NoorStatus,
} from './generatedContract';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UTC_TIMESTAMP_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;
const MAX_QUESTION_CHARACTERS = 500;
const MAX_HISTORY_TURNS = 6;
const MAX_HISTORY_TURN_CHARACTERS = 1000;
const MAX_HISTORY_CHARACTERS = 6000;

const SURAH_VERSE_COUNTS: readonly number[] = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109,
    123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60,
    34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45,
    60, 49, 62, 55, 78, 96, 29, 22, 24, 13,
    14, 11, 11, 18, 12, 12, 30, 52, 52, 44,
    28, 28, 20, 56, 40, 31, 50, 40, 46, 42,
    29, 19, 36, 25, 22, 17, 19, 26, 30, 20,
    15, 21, 11, 8, 8, 19, 5, 8, 8, 11,
    11, 8, 3, 9, 5, 4, 7, 3, 6, 3,
    5, 4, 5, 6,
];

const NOOR_SOURCES: readonly NoorSource[] = [
    'ibn_kathir_en_abridged',
    'al_sadi_ar',
];

const NOOR_STATUSES: readonly NoorStatus[] = [
    'answered',
    'insufficient_evidence',
    'policy_refusal',
    'not_entitled',
    'quota_exceeded',
    'invalid_request',
    'temporarily_unavailable',
];

export const APP_TO_CORPUS_SOURCE = {
    ibn_kathir: 'ibn_kathir_en_abridged',
    al_sadi: 'al_sadi_ar',
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidRequest(): never {
    throw new Error('Invalid Noor request');
}

function invalidAnswer(): never {
    throw new Error('Invalid Noor answer');
}

function isValidRequestId(value: unknown): value is string {
    return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isBoundedNonblankString(value: unknown, maximumLength: number): value is string {
    return typeof value === 'string'
        && value.length >= 1
        && value.length <= maximumLength
        && value.trim().length > 0;
}

function isNoorSource(value: unknown): value is NoorSource {
    return typeof value === 'string' && NOOR_SOURCES.includes(value as NoorSource);
}

function isNoorStatus(value: unknown): value is NoorStatus {
    return typeof value === 'string' && NOOR_STATUSES.includes(value as NoorStatus);
}

function isValidQuranReference(surah: unknown, verse: unknown): surah is number {
    if (!Number.isInteger(surah) || !Number.isInteger(verse)) {
        return false;
    }
    if (typeof surah !== 'number' || typeof verse !== 'number') {
        return false;
    }
    if (surah < 1 || surah > SURAH_VERSE_COUNTS.length || verse < 1) {
        return false;
    }
    const verseCount = SURAH_VERSE_COUNTS[surah - 1];
    return verseCount !== undefined && verse <= verseCount;
}

function parseHistory(value: unknown): NoorHistoryTurn[] {
    if (!Array.isArray(value) || value.length > MAX_HISTORY_TURNS) {
        return invalidRequest();
    }

    const inputs: unknown[] = value;
    let totalCharacters = 0;
    const history = inputs.map((turn): NoorHistoryTurn => {
        if (!isRecord(turn)) {
            return invalidRequest();
        }
        if (turn.role !== 'user' && turn.role !== 'assistant') {
            return invalidRequest();
        }
        if (!isBoundedNonblankString(turn.content, MAX_HISTORY_TURN_CHARACTERS)) {
            return invalidRequest();
        }
        totalCharacters += turn.content.length;
        return {
            role: turn.role,
            content: turn.content,
        };
    });

    if (totalCharacters > MAX_HISTORY_CHARACTERS) {
        return invalidRequest();
    }
    return history;
}

function parseVerseFields(input: Record<string, unknown>): {
    requestId: string;
    source: NoorSource;
    surah: number;
    verse: number;
} {
    if (!isValidRequestId(input.requestId)
        || !isNoorSource(input.source)
        || !isValidQuranReference(input.surah, input.verse)
        || typeof input.verse !== 'number') {
        return invalidRequest();
    }
    return {
        requestId: input.requestId,
        source: input.source,
        surah: input.surah,
        verse: input.verse,
    };
}

export function parseNoorRequest(value: unknown): NoorRequest {
    if (!isRecord(value) || typeof value.mode !== 'string') {
        return invalidRequest();
    }

    if (value.mode === 'chat') {
        if (!isValidRequestId(value.requestId)
            || !isBoundedNonblankString(value.question, MAX_QUESTION_CHARACTERS)) {
            return invalidRequest();
        }
        return {
            mode: 'chat',
            requestId: value.requestId,
            question: value.question,
            history: parseHistory(value.history),
        };
    }

    if (value.mode === 'verse_summary') {
        const fields = parseVerseFields(value);
        return {
            mode: 'verse_summary',
            requestId: fields.requestId,
            source: fields.source,
            surah: fields.surah,
            verse: fields.verse,
        };
    }

    if (value.mode === 'verse_question') {
        const fields = parseVerseFields(value);
        if (!isBoundedNonblankString(value.question, MAX_QUESTION_CHARACTERS)) {
            return invalidRequest();
        }
        return {
            mode: 'verse_question',
            requestId: fields.requestId,
            source: fields.source,
            surah: fields.surah,
            verse: fields.verse,
            question: value.question,
        };
    }

    return invalidRequest();
}

function parseCitation(value: unknown): NoorCitation {
    if (!isRecord(value)
        || !isBoundedNonblankString(value.chunkId, Number.MAX_SAFE_INTEGER)
        || !isBoundedNonblankString(value.canonicalUnitId, Number.MAX_SAFE_INTEGER)
        || !isNoorSource(value.source)
        || !isBoundedNonblankString(value.sourceTitle, Number.MAX_SAFE_INTEGER)
        || !isValidQuranReference(value.surah, value.verseStart)
        || !isValidQuranReference(value.surah, value.verseEnd)
        || typeof value.verseStart !== 'number'
        || typeof value.verseEnd !== 'number'
        || value.verseStart > value.verseEnd
        || !isBoundedNonblankString(value.corpusVersion, Number.MAX_SAFE_INTEGER)) {
        return invalidAnswer();
    }

    return {
        chunkId: value.chunkId,
        canonicalUnitId: value.canonicalUnitId,
        source: value.source,
        sourceTitle: value.sourceTitle,
        surah: value.surah,
        verseStart: value.verseStart,
        verseEnd: value.verseEnd,
        corpusVersion: value.corpusVersion,
    };
}

function isValidUtcTimestamp(value: unknown): value is string {
    if (typeof value !== 'string') {
        return false;
    }
    const match = UTC_TIMESTAMP_PATTERN.exec(value);
    if (match === null) {
        return false;
    }
    const milliseconds = (match[2] ?? '').padEnd(3, '0');
    const canonical = `${match[1]}.${milliseconds || '000'}Z`;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === canonical;
}

export function parseNoorAnswer(value: unknown): NoorAnswer {
    if (!isRecord(value)
        || !isValidRequestId(value.requestId)
        || typeof value.answer !== 'string'
        || !isNoorStatus(value.status)
        || !Array.isArray(value.citations)) {
        return invalidAnswer();
    }

    const citationInputs: unknown[] = value.citations;
    const citations = citationInputs.map(parseCitation);
    if (value.status === 'quota_exceeded') {
        if (!isValidUtcTimestamp(value.nextResetAt)) {
            return invalidAnswer();
        }
        return {
            requestId: value.requestId,
            answer: value.answer,
            status: value.status,
            citations,
            nextResetAt: value.nextResetAt,
        };
    }

    if ('nextResetAt' in value) {
        return invalidAnswer();
    }
    return {
        requestId: value.requestId,
        answer: value.answer,
        status: value.status,
        citations,
    };
}
