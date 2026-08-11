import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import type { NoorSource } from './generatedContract';

export const NORMALIZATION_VERSION = 'html-entities-nfc-whitespace-v1';
export const CHUNKING_VERSION = 'raw-paragraph-sentence-900-1400-overlap-80-v1';
export const DEFAULT_TARGET_TOKENS = 900;
export const DEFAULT_HARD_MAX_TOKENS = 1400;
export const DEFAULT_OVERLAP_TOKENS = 80;
export const MAX_CHUNKING_CONCURRENCY = 8;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_ORDER: readonly NoorSource[] = ['ibn_kathir_en_abridged', 'al_sadi_ar'];
const QURAN_VERSE_COUNTS: readonly number[] = [
    7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98,
    135, 112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85,
    54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11,
    11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36, 25,
    22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6,
    3, 5, 4, 5, 6,
];

export interface TokenCounter {
    mode: string;
    model: string;
    countTokens(text: string): Promise<number>;
}

export interface CorpusSourceFile {
    surah: number;
    verses: Record<string, unknown>;
}

export interface CorpusSourceInput {
    source: NoorSource;
    sourceTitle: string;
    language: 'en' | 'ar';
    resourceId: number;
    upstreamReference: string;
    editionLabel: string;
    files: CorpusSourceFile[];
}

export interface CorpusCoverageSource {
    source: NoorSource;
    sourceTitle: string;
    resourceId: number;
    fileCount: number;
    mappingCount: number;
    missingVerseKeys: string[];
}

export interface CorpusCoverage {
    schemaVersion: 1;
    retrievedAt: string;
    sources: CorpusCoverageSource[];
}

export interface CanonicalUnit {
    canonicalUnitId: string;
    source: NoorSource;
    sourceTitle: string;
    language: 'en' | 'ar';
    surah: number;
    verseStart: number;
    verseEnd: number;
    originalText: string;
    retrievalText: string;
    corpusVersion: string;
    contentHash: string;
    resourceId: number;
    upstreamReference: string;
    editionLabel: string;
    normalizationVersion: typeof NORMALIZATION_VERSION;
}

export interface CorpusChunk {
    chunkId: string;
    canonicalUnitId: string;
    chunkIndex: number;
    source: NoorSource;
    sourceTitle: string;
    language: 'en' | 'ar';
    surah: number;
    verseStart: number;
    verseEnd: number;
    originalStart: number;
    originalEnd: number;
    originalText: string;
    retrievalText: string;
    corpusVersion: string;
    contentHash: string;
    tokenCount: number;
}

export interface VerseLookup {
    lookupId: string;
    source: NoorSource;
    surah: number;
    verse: number;
    canonicalUnitId: string;
    chunkIds: string[];
}

export interface CorpusSourceCount {
    source: NoorSource;
    fileCount: number;
    mappingCount: number;
    unitCount: number;
    missingVerseKeys: string[];
}

export interface CorpusManifest {
    schemaVersion: 1;
    corpusVersion: string;
    normalizationVersion: typeof NORMALIZATION_VERSION;
    chunkingVersion: typeof CHUNKING_VERSION;
    tokenizerMode: string;
    tokenizerModel: string;
    targetTokens: number;
    hardMaxTokens: number;
    overlapTokens: number;
    sourceCounts: CorpusSourceCount[];
    unitCount: number;
    chunkCount: number;
    lookupCount: number;
    artifactSha256: {
        units: string;
        chunks: string;
        lookups: string;
    };
    aggregateSha256: string;
}

export interface CorpusArtifacts {
    units: CanonicalUnit[];
    chunks: CorpusChunk[];
    lookups: VerseLookup[];
    manifest: CorpusManifest;
}

export interface BuildCorpusInput {
    corpusVersion: string;
    tokenCounter: TokenCounter;
    sources: CorpusSourceInput[];
    targetTokens?: number;
    hardMaxTokens?: number;
    overlapTokens?: number;
    chunkConcurrency?: number;
}

interface ExplicitVerse {
    sourceInput: CorpusSourceInput;
    surah: number;
    verse: number;
    originalText: string;
}

function sha256(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
    return `${JSON.stringify(value, undefined, 2)}\n`;
}

function artifactHashes(
    units: readonly CanonicalUnit[],
    chunks: readonly CorpusChunk[],
    lookups: readonly VerseLookup[],
): CorpusManifest['artifactSha256'] {
    return {
        units: sha256(stableJson(units)),
        chunks: sha256(stableJson(chunks)),
        lookups: sha256(stableJson(lookups)),
    };
}

function aggregateSha256(hashes: CorpusManifest['artifactSha256']): string {
    return sha256((['chunks', 'lookups', 'units'] as const)
        .map(name => `${name}.json\0${hashes[name]}\n`)
        .join(''));
}

function decodeHtmlEntities(text: string): string {
    const named: Readonly<Record<string, string>> = {
        amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
    };
    return text.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (entity, body: string) => {
        if (body.startsWith('#')) {
            const hexadecimal = body[1]?.toLowerCase() === 'x';
            const digits = body.slice(hexadecimal ? 2 : 1);
            const codePoint = Number.parseInt(digits, hexadecimal ? 16 : 10);
            if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
                return String.fromCodePoint(codePoint);
            }
            return entity;
        }
        return named[body.toLowerCase()] ?? entity;
    });
}

export function normalizeRetrievalText(originalText: string): string {
    return decodeHtmlEntities(originalText).normalize('NFC').replace(/\s+/gu, ' ').trim();
}

export function canonicalUnitId(
    corpusVersion: string,
    source: NoorSource,
    surah: number,
    verseStart: number,
    verseEnd: number,
    contentHash: string,
): string {
    return `u_${sha256(`${corpusVersion}\0${source}\0${surah}:${verseStart}-${verseEnd}\0${contentHash}`)}`;
}

function explicitVerses(sourceInput: CorpusSourceInput): ExplicitVerse[] {
    const result: ExplicitVerse[] = [];
    for (const file of [...sourceInput.files].sort((left, right) => left.surah - right.surah)) {
        const verseCount = QURAN_VERSE_COUNTS[file.surah - 1];
        if (!Number.isInteger(file.surah) || verseCount === undefined) {
            throw new Error(`Invalid surah ${file.surah} for ${sourceInput.source}`);
        }
        const entries = Object.entries(file.verses)
            .map(([key, value]) => ({ verse: Number(key), value }))
            .filter(entry => Number.isInteger(entry.verse) && entry.verse >= 1 && entry.verse <= verseCount)
            .sort((left, right) => left.verse - right.verse);
        for (const entry of entries) {
            if (!isRecord(entry.value)
                || typeof entry.value.text !== 'string'
                || entry.value.text.trim().length === 0) {
                continue;
            }
            result.push({
                sourceInput,
                surah: file.surah,
                verse: entry.verse,
                originalText: entry.value.text,
            });
        }
    }
    return result;
}

function buildUnits(corpusVersion: string, sourceInput: CorpusSourceInput): {
    units: CanonicalUnit[];
    unitVerses: Map<string, number[]>;
    verses: ExplicitVerse[];
} {
    const verses = explicitVerses(sourceInput);
    const groups: ExplicitVerse[][] = [];
    for (const verse of verses) {
        const current = groups[groups.length - 1];
        const previous = current?.[current.length - 1];
        if (current && previous
            && previous.surah === verse.surah
            && previous.verse + 1 === verse.verse
            && previous.originalText === verse.originalText) {
            current.push(verse);
        } else {
            groups.push([verse]);
        }
    }

    const unitVerses = new Map<string, number[]>();
    const units = groups.map((group): CanonicalUnit => {
        const first = group[0];
        const last = group[group.length - 1];
        if (!first || !last) {
            throw new Error('Empty canonical group');
        }
        const contentHash = sha256(first.originalText);
        const id = canonicalUnitId(
            corpusVersion,
            sourceInput.source,
            first.surah,
            first.verse,
            last.verse,
            contentHash,
        );
        unitVerses.set(id, group.map(item => item.verse));
        return {
            canonicalUnitId: id,
            source: sourceInput.source,
            sourceTitle: sourceInput.sourceTitle,
            language: sourceInput.language,
            surah: first.surah,
            verseStart: first.verse,
            verseEnd: last.verse,
            originalText: first.originalText,
            retrievalText: normalizeRetrievalText(first.originalText),
            corpusVersion,
            contentHash,
            resourceId: sourceInput.resourceId,
            upstreamReference: sourceInput.upstreamReference,
            editionLabel: sourceInput.editionLabel,
            normalizationVersion: NORMALIZATION_VERSION,
        };
    });
    return { units, unitVerses, verses };
}

function candidateEnds(text: string, start: number): number[] {
    const ends = new Set<number>([text.length]);
    const boundary = /(?:\r?\n\s*\r?\n|[.!?\u061f\u06d4]+(?:["'\u2019\u201d)\]}]+)?\s*)/gu;
    boundary.lastIndex = start;
    for (let match = boundary.exec(text); match; match = boundary.exec(text)) {
        if (boundary.lastIndex > start) {
            ends.add(boundary.lastIndex);
        }
        if (boundary.lastIndex === match.index) {
            boundary.lastIndex += 1;
        }
    }
    return [...ends].filter(end => end > start).sort((left, right) => left - right);
}

async function largestEndWithin(
    text: string,
    start: number,
    maximumTokens: number,
    counter: TokenCounter,
): Promise<number> {
    let low = start + 1;
    let high = text.length;
    let best = start;
    while (low <= high) {
        const midpoint = Math.floor((low + high) / 2);
        const count = await counter.countTokens(text.slice(start, midpoint));
        if (count <= maximumTokens) {
            best = midpoint;
            low = midpoint + 1;
        } else {
            high = midpoint - 1;
        }
    }
    if (best === start) {
        throw new Error('Token counter cannot fit one source character within hard maximum');
    }
    if (best < text.length) {
        const whitespace = text.slice(start, best).search(/\s+\S*$/u);
        if (whitespace > 0 && await counter.countTokens(text.slice(start, start + whitespace)) > 0) {
            return start + whitespace;
        }
    }
    return best;
}

async function chooseEnd(
    text: string,
    start: number,
    targetTokens: number,
    hardMaxTokens: number,
    counter: TokenCounter,
): Promise<number> {
    let bestTarget = start;
    for (const end of candidateEnds(text, start)) {
        const count = await counter.countTokens(text.slice(start, end));
        if (count <= targetTokens) {
            bestTarget = end;
            continue;
        }
        if (bestTarget > start) {
            return bestTarget;
        }
        if (count <= hardMaxTokens) {
            return end;
        }
        return largestEndWithin(text, start, hardMaxTokens, counter);
    }
    return text.length;
}

async function overlapStart(
    text: string,
    chunkStart: number,
    chunkEnd: number,
    overlapTokens: number,
    counter: TokenCounter,
): Promise<number> {
    if (overlapTokens === 0) {
        return chunkEnd;
    }
    let low = chunkStart + 1;
    let high = chunkEnd;
    let best = chunkEnd;
    while (low <= high) {
        const midpoint = Math.floor((low + high) / 2);
        const count = await counter.countTokens(text.slice(midpoint, chunkEnd));
        if (count <= overlapTokens) {
            best = midpoint;
            high = midpoint - 1;
        } else {
            low = midpoint + 1;
        }
    }
    return Math.max(chunkStart + 1, best);
}

async function chunkUnit(
    unit: CanonicalUnit,
    tokenCounter: TokenCounter,
    targetTokens: number,
    hardMaxTokens: number,
    overlapTokens: number,
): Promise<CorpusChunk[]> {
    const chunks: CorpusChunk[] = [];
    let start = 0;
    while (start < unit.originalText.length) {
        const end = await chooseEnd(unit.originalText, start, targetTokens, hardMaxTokens, tokenCounter);
        const originalText = unit.originalText.slice(start, end);
        const contentHash = sha256(originalText);
        const chunkIndex = chunks.length;
        const tokenCount = await tokenCounter.countTokens(originalText);
        if (tokenCount > hardMaxTokens || end <= start) {
            throw new Error(`Unable to satisfy chunk maximum for ${unit.canonicalUnitId}`);
        }
        chunks.push({
            chunkId: `c_${unit.canonicalUnitId.slice(2)}_${String(chunkIndex).padStart(3, '0')}_${contentHash.slice(0, 12)}`,
            canonicalUnitId: unit.canonicalUnitId,
            chunkIndex,
            source: unit.source,
            sourceTitle: unit.sourceTitle,
            language: unit.language,
            surah: unit.surah,
            verseStart: unit.verseStart,
            verseEnd: unit.verseEnd,
            originalStart: start,
            originalEnd: end,
            originalText,
            retrievalText: normalizeRetrievalText(originalText),
            corpusVersion: unit.corpusVersion,
            contentHash,
            tokenCount,
        });
        if (end === unit.originalText.length) {
            break;
        }
        start = await overlapStart(unit.originalText, start, end, overlapTokens, tokenCounter);
    }
    return chunks;
}

async function chunkUnits(
    units: readonly CanonicalUnit[],
    tokenCounter: TokenCounter,
    targetTokens: number,
    hardMaxTokens: number,
    overlapTokens: number,
    concurrency: number,
): Promise<CorpusChunk[]> {
    const chunksByUnit = new Array<CorpusChunk[]>(units.length);
    let nextIndex = 0;
    const worker = async (): Promise<void> => {
        while (nextIndex < units.length) {
            const index = nextIndex;
            nextIndex += 1;
            const unit = units[index];
            if (!unit) {
                throw new Error(`Missing canonical unit at index ${index}`);
            }
            chunksByUnit[index] = await chunkUnit(
                unit,
                tokenCounter,
                targetTokens,
                hardMaxTokens,
                overlapTokens,
            );
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, units.length) }, worker));
    return chunksByUnit.flat();
}

function missingVerseKeys(verses: readonly ExplicitVerse[]): string[] {
    const present = new Set(verses.map(verse => `${verse.surah}:${verse.verse}`));
    const missing: string[] = [];
    for (let surah = 1; surah <= QURAN_VERSE_COUNTS.length; surah += 1) {
        const verseCount = QURAN_VERSE_COUNTS[surah - 1];
        if (verseCount === undefined) {
            continue;
        }
        for (let verse = 1; verse <= verseCount; verse += 1) {
            const key = `${surah}:${verse}`;
            if (!present.has(key)) {
                missing.push(key);
            }
        }
    }
    return missing;
}

export async function buildCorpus(input: BuildCorpusInput): Promise<CorpusArtifacts> {
    const targetTokens = input.targetTokens ?? DEFAULT_TARGET_TOKENS;
    const hardMaxTokens = input.hardMaxTokens ?? DEFAULT_HARD_MAX_TOKENS;
    const overlapTokens = input.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
    const chunkConcurrency = input.chunkConcurrency ?? 1;
    if (!input.corpusVersion || !input.tokenCounter.mode || !input.tokenCounter.model
        || !Number.isInteger(targetTokens) || !Number.isInteger(hardMaxTokens)
        || !Number.isInteger(overlapTokens) || !Number.isInteger(chunkConcurrency)
        || targetTokens < 1 || hardMaxTokens < targetTokens
        || chunkConcurrency < 1 || chunkConcurrency > MAX_CHUNKING_CONCURRENCY
        || overlapTokens < 0 || overlapTokens >= targetTokens) {
        throw new Error('Invalid corpus build configuration');
    }

    const units: CanonicalUnit[] = [];
    const chunks: CorpusChunk[] = [];
    const lookups: VerseLookup[] = [];
    const sourceCounts: CorpusSourceCount[] = [];
    const orderedSources = [...input.sources].sort(
        (left, right) => SOURCE_ORDER.indexOf(left.source) - SOURCE_ORDER.indexOf(right.source),
    );
    for (const sourceInput of orderedSources) {
        const built = buildUnits(input.corpusVersion, sourceInput);
        const sourceChunks = await chunkUnits(
            built.units,
            input.tokenCounter,
            targetTokens,
            hardMaxTokens,
            overlapTokens,
            chunkConcurrency,
        );
        const chunksByUnit = new Map<string, string[]>();
        for (const chunk of sourceChunks) {
            const ids = chunksByUnit.get(chunk.canonicalUnitId) ?? [];
            ids.push(chunk.chunkId);
            chunksByUnit.set(chunk.canonicalUnitId, ids);
        }
        for (const unit of built.units) {
            const verses = built.unitVerses.get(unit.canonicalUnitId) ?? [];
            for (const verse of verses) {
                lookups.push({
                    lookupId: `${unit.source}_${unit.surah}_${verse}`,
                    source: unit.source,
                    surah: unit.surah,
                    verse,
                    canonicalUnitId: unit.canonicalUnitId,
                    chunkIds: [...(chunksByUnit.get(unit.canonicalUnitId) ?? [])],
                });
            }
        }
        units.push(...built.units);
        chunks.push(...sourceChunks);
        sourceCounts.push({
            source: sourceInput.source,
            fileCount: sourceInput.files.length,
            mappingCount: built.verses.length,
            unitCount: built.units.length,
            missingVerseKeys: missingVerseKeys(built.verses),
        });
    }

    const hashes = artifactHashes(units, chunks, lookups);
    return {
        units,
        chunks,
        lookups,
        manifest: {
            schemaVersion: 1,
            corpusVersion: input.corpusVersion,
            normalizationVersion: NORMALIZATION_VERSION,
            chunkingVersion: CHUNKING_VERSION,
            tokenizerMode: input.tokenCounter.mode,
            tokenizerModel: input.tokenCounter.model,
            targetTokens,
            hardMaxTokens,
            overlapTokens,
            sourceCounts,
            unitCount: units.length,
            chunkCount: chunks.length,
            lookupCount: lookups.length,
            artifactSha256: hashes,
            aggregateSha256: aggregateSha256(hashes),
        },
    };
}

function sameJson(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

export async function validateCorpus(
    artifacts: CorpusArtifacts,
    coverage: CorpusCoverage,
    tokenCounter: TokenCounter,
): Promise<string[]> {
    const errors: string[] = [];
    const unitById = new Map(artifacts.units.map(unit => [unit.canonicalUnitId, unit]));
    for (const unit of artifacts.units) {
        const contentHash = sha256(unit.originalText);
        const expectedId = canonicalUnitId(
            unit.corpusVersion,
            unit.source,
            unit.surah,
            unit.verseStart,
            unit.verseEnd,
            contentHash,
        );
        if (unit.contentHash !== contentHash || unit.canonicalUnitId !== expectedId) {
            errors.push(`unit ${unit.canonicalUnitId} has invalid hash or ID`);
        }
        if (unit.retrievalText !== normalizeRetrievalText(unit.originalText)) {
            errors.push(`unit ${unit.canonicalUnitId} has invalid retrieval text`);
        }
    }
    const chunksByUnit = new Map<string, CorpusChunk[]>();
    for (const chunk of artifacts.chunks) {
        const unit = unitById.get(chunk.canonicalUnitId);
        if (!unit) {
            errors.push(`chunk ${chunk.chunkId} references a missing unit`);
            continue;
        }
        const sliced = unit.originalText.slice(chunk.originalStart, chunk.originalEnd);
        const contentHash = sha256(chunk.originalText);
        const expectedId = `c_${unit.canonicalUnitId.slice(2)}_${String(chunk.chunkIndex).padStart(3, '0')}_${contentHash.slice(0, 12)}`;
        if (chunk.originalStart < 0 || chunk.originalEnd <= chunk.originalStart
            || chunk.originalEnd > unit.originalText.length || sliced !== chunk.originalText) {
            errors.push(`chunk ${chunk.chunkId} offsets do not match its original slice`);
        }
        if (chunk.contentHash !== contentHash || chunk.chunkId !== expectedId) {
            errors.push(`chunk ${chunk.chunkId} has invalid hash or ID`);
        }
        const tokenCount = await tokenCounter.countTokens(chunk.originalText);
        if (chunk.tokenCount !== tokenCount || tokenCount > artifacts.manifest.hardMaxTokens) {
            errors.push(`chunk ${chunk.chunkId} violates token count maximum`);
        }
        const grouped = chunksByUnit.get(chunk.canonicalUnitId) ?? [];
        grouped.push(chunk);
        chunksByUnit.set(chunk.canonicalUnitId, grouped);
    }
    for (const lookup of artifacts.lookups) {
        const unit = unitById.get(lookup.canonicalUnitId);
        const expectedChunkIds = (chunksByUnit.get(lookup.canonicalUnitId) ?? [])
            .sort((left, right) => left.chunkIndex - right.chunkIndex)
            .map(chunk => chunk.chunkId);
        if (!unit || unit.source !== lookup.source || unit.surah !== lookup.surah
            || lookup.verse < unit.verseStart || lookup.verse > unit.verseEnd
            || !sameJson(lookup.chunkIds, expectedChunkIds)) {
            errors.push(`lookup ${lookup.lookupId} is inconsistent with its unit and chunks`);
        }
    }
    const expectedCounts = coverage.sources.map(source => ({
        source: source.source,
        fileCount: source.fileCount,
        mappingCount: source.mappingCount,
        unitCount: artifacts.units.filter(unit => unit.source === source.source).length,
        missingVerseKeys: source.missingVerseKeys,
    }));
    if (!sameJson(artifacts.manifest.sourceCounts, expectedCounts)) {
        errors.push('manifest source counts or exact coverage gaps do not match the reviewed report');
    }
    if (artifacts.manifest.unitCount !== artifacts.units.length
        || artifacts.manifest.chunkCount !== artifacts.chunks.length
        || artifacts.manifest.lookupCount !== artifacts.lookups.length) {
        errors.push('manifest aggregate counts do not match artifacts');
    }
    const hashes = artifactHashes(artifacts.units, artifacts.chunks, artifacts.lookups);
    if (!sameJson(artifacts.manifest.artifactSha256, hashes)
        || artifacts.manifest.aggregateSha256 !== aggregateSha256(hashes)) {
        errors.push('manifest aggregate hash does not match artifacts');
    }
    if (!SHA256_PATTERN.test(artifacts.manifest.aggregateSha256)) {
        errors.push('manifest aggregate hash is not lowercase SHA-256');
    }
    return errors;
}

function parseCoverage(value: unknown): CorpusCoverage {
    if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.retrievedAt !== 'string'
        || !Array.isArray(value.sources)) {
        throw new Error('Invalid corpus coverage report');
    }
    const sources = value.sources.map((item): CorpusCoverageSource => {
        if (!isRecord(item)
            || !SOURCE_ORDER.includes(item.source as NoorSource)
            || typeof item.sourceTitle !== 'string'
            || typeof item.resourceId !== 'number'
            || typeof item.fileCount !== 'number'
            || typeof item.mappingCount !== 'number'
            || !Array.isArray(item.missingVerseKeys)
            || !item.missingVerseKeys.every(key => typeof key === 'string')) {
            throw new Error('Invalid corpus coverage source');
        }
        return {
            source: item.source as NoorSource,
            sourceTitle: item.sourceTitle,
            resourceId: item.resourceId,
            fileCount: item.fileCount,
            mappingCount: item.mappingCount,
            missingVerseKeys: item.missingVerseKeys as string[],
        };
    });
    return { schemaVersion: 1, retrievedAt: value.retrievedAt, sources };
}

export function loadReviewedCorpusInputs(repositoryRoot: string): {
    sources: CorpusSourceInput[];
    coverage: CorpusCoverage;
} {
    const coverage = parseCoverage(JSON.parse(readFileSync(
        resolve(repositoryRoot, 'docs/noor-rag/corpus-coverage.json'),
        'utf8',
    )) as unknown);
    const provenance = JSON.parse(readFileSync(
        resolve(repositoryRoot, 'docs/noor-rag/corpus-provenance.json'),
        'utf8',
    )) as unknown;
    if (!isRecord(provenance) || !Array.isArray(provenance.sources)) {
        throw new Error('Invalid corpus provenance manifest');
    }
    const sources = provenance.sources.map((value): CorpusSourceInput => {
        if (!isRecord(value)
            || !SOURCE_ORDER.includes(value.source as NoorSource)
            || typeof value.sourceTitle !== 'string'
            || (value.language !== 'en' && value.language !== 'ar')
            || typeof value.resourceId !== 'number'
            || typeof value.upstreamReference !== 'string'
            || typeof value.editionLabel !== 'string'
            || typeof value.corpusPath !== 'string') {
            throw new Error('Invalid corpus provenance source');
        }
        const directory = resolve(repositoryRoot, value.corpusPath);
        const files = readdirSync(directory)
            .filter(name => /^surah_\d{3}\.json$/u.test(name))
            .sort()
            .map((name): CorpusSourceFile => {
                const parsed = JSON.parse(readFileSync(resolve(directory, name), 'utf8')) as unknown;
                if (!isRecord(parsed) || !isRecord(parsed.verses)) {
                    throw new Error(`Invalid corpus file ${name}`);
                }
                return { surah: Number(name.slice(6, 9)), verses: parsed.verses };
            });
        return {
            source: value.source as NoorSource,
            sourceTitle: value.sourceTitle,
            language: value.language,
            resourceId: value.resourceId,
            upstreamReference: value.upstreamReference,
            editionLabel: value.editionLabel,
            files,
        };
    });
    return { sources, coverage };
}

export function serializeCorpusArtifact(value: unknown): string {
    return stableJson(value);
}
