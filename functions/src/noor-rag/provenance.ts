import { createHash } from 'node:crypto';

export const AGGREGATE_HASH_METHOD = 'sha256-utf8(sorted-by-path(path + "\\u0000" + lowercase-file-sha256 + "\\n"))';

const EXPECTED_FILE_COUNT = 114;
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const RESOURCE_CATALOG_URL = 'https://api.quran.com/api/v4/resources/tafsirs';
const DEVELOPER_TERMS_URL = 'https://api-docs.quran.foundation/legal/developer-terms/';
const REDISTRIBUTION_STATUS = 'not_proven_for_public_commercial_redistribution';

const REQUIRED_ACTIVATION_BLOCKERS = [
    'translator_publisher_edition_and_revision_not_stated',
    'content_sync_or_long_term_storage_basis_not_proven',
    'commercial_redistribution_license_not_proven',
    'machine_learning_use_written_consent_not_proven',
    'upstream_corpus_has_known_coverage_gaps',
] as const;

export type CorpusSourceId = 'ibn_kathir_en_abridged' | 'al_sadi_ar';
export type CorpusLanguage = 'en' | 'ar';
export type ActivationBlocker = typeof REQUIRED_ACTIVATION_BLOCKERS[number];

export interface ProvenanceFile {
    path: string;
    sha256: string;
}

export interface RedistributionBasis {
    status: typeof REDISTRIBUTION_STATUS;
    reference: string;
    termsLastUpdated: string;
    summary: string;
}

export interface CorpusIntegrityRecord {
    hashScope: 'exact_committed_bytes';
    currentApiEqualityVerified: true;
    affectedFileCount: number;
    replacementCharacterCount: number;
    mappingCount: number;
    missingVerseKeyCount: number;
    coverageReport: 'docs/noor-rag/corpus-coverage.json';
}

export interface CorpusProvenanceSource {
    source: CorpusSourceId;
    sourceTitle: string;
    language: CorpusLanguage;
    resourceId: number;
    upstreamReference: string;
    editionLabel: string;
    retrievedAt: string;
    redistributionBasis: RedistributionBasis;
    corpusPath: string;
    integrity: CorpusIntegrityRecord;
    files: ProvenanceFile[];
    aggregateSha256: string;
}

export interface CorpusProvenanceManifest {
    schemaVersion: 1;
    aggregateHashMethod: typeof AGGREGATE_HASH_METHOD;
    publicActivationApproved: false;
    activationBlockers: ActivationBlocker[];
    sources: CorpusProvenanceSource[];
}

export interface ProvenanceValidationResult {
    errors: string[];
    manifest?: CorpusProvenanceManifest;
}

export interface ProvenanceValidationOptions {
    currentUtcDate: string;
}

interface SourceExpectation {
    sourceTitle: string;
    language: CorpusLanguage;
    resourceId: number;
    editionLabel: string;
    corpusPath: string;
    affectedFileCount: number;
    replacementCharacterCount: number;
    mappingCount: number;
    missingVerseKeyCount: number;
}

const SOURCE_EXPECTATIONS: Record<CorpusSourceId, SourceExpectation> = {
    ibn_kathir_en_abridged: {
        sourceTitle: 'Ibn Kathir (Abridged)',
        language: 'en',
        resourceId: 169,
        editionLabel: 'Quran.com catalog: Ibn Kathir (Abridged), English; translator, publisher, edition, and revision not stated',
        corpusPath: 'src/features/tafsir/data/tafsir/ibn_kathir',
        affectedFileCount: 0,
        replacementCharacterCount: 0,
        mappingCount: 6231,
        missingVerseKeyCount: 5,
    },
    al_sadi_ar: {
        sourceTitle: "السعدي Al-Sa'di",
        language: 'ar',
        resourceId: 91,
        editionLabel: "Quran.com catalog: السعدي Al-Sa'di, Arabic; translator, publisher, edition, and revision not stated",
        corpusPath: 'src/features/tafsir/data/tafsir/al_sadi',
        affectedFileCount: 0,
        replacementCharacterCount: 0,
        mappingCount: 6177,
        missingVerseKeyCount: 59,
    },
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateFields(
    record: Record<string, unknown>,
    allowedFields: readonly string[],
    context: string,
    errors: string[],
): void {
    for (const field of allowedFields) {
        if (!Object.prototype.hasOwnProperty.call(record, field)) {
            errors.push(`${context}.${field} is required`);
        }
    }
    for (const field of Object.keys(record)) {
        if (!allowedFields.includes(field)) {
            errors.push(`${context} has unknown field ${field}`);
        }
    }
}

function readString(
    record: Record<string, unknown>,
    field: string,
    context: string,
    errors: string[],
): string {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0) {
        if (Object.prototype.hasOwnProperty.call(record, field)) {
            errors.push(`${context}.${field} must be a non-empty string`);
        }
        return '';
    }
    return value;
}

function isValidIsoDate(value: string): boolean {
    const match = ISO_DATE.exec(value);
    if (!match) {
        return false;
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year
        && date.getUTCMonth() === month - 1
        && date.getUTCDate() === day;
}

function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

function parseRedistributionBasis(
    input: unknown,
    currentUtcDate: string,
    context: string,
    errors: string[],
): RedistributionBasis | undefined {
    if (!isRecord(input)) {
        if (input !== undefined) {
            errors.push(`${context} must be an object`);
        }
        return undefined;
    }
    validateFields(input, ['status', 'reference', 'termsLastUpdated', 'summary'], context, errors);
    const status = readString(input, 'status', context, errors);
    const reference = readString(input, 'reference', context, errors);
    const termsLastUpdated = readString(input, 'termsLastUpdated', context, errors);
    const summary = readString(input, 'summary', context, errors);

    if (status !== REDISTRIBUTION_STATUS) {
        errors.push(`${context}.status is unsupported; availability is not redistribution permission`);
    }
    if (!isHttpsUrl(reference)) {
        errors.push(`${context}.reference must be an HTTPS URL`);
    } else if (reference !== DEVELOPER_TERMS_URL) {
        errors.push(`${context}.reference must identify the official Quran Foundation developer terms`);
    }
    const termsDateIsValid = isValidIsoDate(termsLastUpdated);
    if (!termsDateIsValid) {
        errors.push(`${context}.termsLastUpdated must use YYYY-MM-DD`);
    } else if (termsLastUpdated > currentUtcDate) {
        errors.push(`${context}.termsLastUpdated must not be after the current UTC date`);
    }
    if (summary.length < 40) {
        errors.push(`${context}.summary must state the unresolved rights basis`);
    }

    if (status !== REDISTRIBUTION_STATUS || reference.length === 0 || termsLastUpdated.length === 0 || summary.length === 0) {
        return undefined;
    }
    return {
        status: REDISTRIBUTION_STATUS,
        reference,
        termsLastUpdated,
        summary,
    };
}

function parseIntegrity(
    input: unknown,
    expectation: SourceExpectation,
    context: string,
    errors: string[],
): CorpusIntegrityRecord | undefined {
    if (!isRecord(input)) {
        if (input !== undefined) {
            errors.push(`${context} must be an object`);
        }
        return undefined;
    }
    validateFields(
        input,
        ['hashScope', 'currentApiEqualityVerified', 'affectedFileCount', 'replacementCharacterCount', 'mappingCount', 'missingVerseKeyCount', 'coverageReport'],
        context,
        errors,
    );
    const hashScope = readString(input, 'hashScope', context, errors);
    const currentApiEqualityVerified = input.currentApiEqualityVerified;
    const affectedFileCount = input.affectedFileCount;
    const replacementCharacterCount = input.replacementCharacterCount;
    const mappingCount = input.mappingCount;
    const missingVerseKeyCount = input.missingVerseKeyCount;
    const coverageReport = input.coverageReport;

    if (hashScope !== 'exact_committed_bytes') {
        errors.push(`${context}.hashScope must be exact_committed_bytes`);
    }
    if (currentApiEqualityVerified !== true) {
        errors.push(`${context}.current API equality must be verified`);
    }
    if (!Number.isInteger(affectedFileCount) || affectedFileCount !== expectation.affectedFileCount) {
        errors.push(`${context}.affectedFileCount does not match the reviewed corpus scan`);
    }
    if (!Number.isInteger(replacementCharacterCount)
        || replacementCharacterCount !== expectation.replacementCharacterCount) {
        errors.push(`${context}.replacementCharacterCount does not match the reviewed corpus scan`);
    }
    if (mappingCount !== expectation.mappingCount) errors.push(`${context}.mappingCount does not match reviewed coverage`);
    if (missingVerseKeyCount !== expectation.missingVerseKeyCount) errors.push(`${context}.missingVerseKeyCount does not match reviewed coverage`);
    if (coverageReport !== 'docs/noor-rag/corpus-coverage.json') errors.push(`${context}.coverageReport must identify the governed coverage report`);

    if (hashScope !== 'exact_committed_bytes'
        || currentApiEqualityVerified !== true
        || affectedFileCount !== expectation.affectedFileCount
        || replacementCharacterCount !== expectation.replacementCharacterCount
        || mappingCount !== expectation.mappingCount
        || missingVerseKeyCount !== expectation.missingVerseKeyCount
        || coverageReport !== 'docs/noor-rag/corpus-coverage.json') {
        return undefined;
    }
    return {
        hashScope: 'exact_committed_bytes',
        currentApiEqualityVerified: true,
        affectedFileCount: expectation.affectedFileCount,
        replacementCharacterCount: expectation.replacementCharacterCount,
        mappingCount: expectation.mappingCount,
        missingVerseKeyCount: expectation.missingVerseKeyCount,
        coverageReport: 'docs/noor-rag/corpus-coverage.json',
    };
}

function parseFiles(
    input: unknown,
    corpusPath: string,
    context: string,
    errors: string[],
): ProvenanceFile[] {
    if (!Array.isArray(input)) {
        if (input !== undefined) {
            errors.push(`${context} must be an array`);
        }
        return [];
    }
    if (input.length !== EXPECTED_FILE_COUNT) {
        errors.push(`${context} must contain exactly 114 files`);
    }

    const files: ProvenanceFile[] = [];
    const seenPaths = new Set<string>();
    for (let index = 0; index < input.length; index += 1) {
        const fileContext = `${context}[${index}]`;
        const fileInput = input[index];
        if (!isRecord(fileInput)) {
            errors.push(`${fileContext} must be an object`);
            continue;
        }
        validateFields(fileInput, ['path', 'sha256'], fileContext, errors);
        const path = readString(fileInput, 'path', fileContext, errors);
        const sha256 = readString(fileInput, 'sha256', fileContext, errors);
        const expectedPath = `${corpusPath}/surah_${String(index + 1).padStart(3, '0')}.json`;
        if (path !== expectedPath) {
            errors.push(`${fileContext} has unexpected file path; expected ${expectedPath}`);
        }
        if (seenPaths.has(path)) {
            errors.push(`${fileContext}.path is duplicated`);
        }
        seenPaths.add(path);
        if (!SHA256.test(sha256)) {
            errors.push(`${fileContext}.sha256 must be 64 lowercase hexadecimal characters`);
        }
        if (path.length > 0 && SHA256.test(sha256)) {
            files.push({ path, sha256 });
        }
    }
    return files;
}

function parseSource(
    input: unknown,
    index: number,
    currentUtcDate: string,
    errors: string[],
): CorpusProvenanceSource | undefined {
    const context = `manifest.sources[${index}]`;
    if (!isRecord(input)) {
        errors.push(`${context} must be an object`);
        return undefined;
    }
    validateFields(input, [
        'source',
        'sourceTitle',
        'language',
        'resourceId',
        'upstreamReference',
        'editionLabel',
        'retrievedAt',
        'redistributionBasis',
        'corpusPath',
        'integrity',
        'files',
        'aggregateSha256',
    ], context, errors);

    const sourceValue = readString(input, 'source', context, errors);
    if (sourceValue !== 'ibn_kathir_en_abridged' && sourceValue !== 'al_sadi_ar') {
        errors.push(`${context}.source is an unsupported source`);
        return undefined;
    }
    const source = sourceValue;
    const expectation = SOURCE_EXPECTATIONS[source];
    const sourceTitle = readString(input, 'sourceTitle', context, errors);
    const language = readString(input, 'language', context, errors);
    const resourceId = input.resourceId;
    const upstreamReference = readString(input, 'upstreamReference', context, errors);
    const editionLabel = readString(input, 'editionLabel', context, errors);
    const retrievedAt = readString(input, 'retrievedAt', context, errors);
    const corpusPath = readString(input, 'corpusPath', context, errors);
    const aggregateSha256 = readString(input, 'aggregateSha256', context, errors);

    if (sourceTitle !== expectation.sourceTitle) {
        errors.push(`${context}.sourceTitle does not match ${source}`);
    }
    if (language !== expectation.language) {
        errors.push(`${context}.language does not match ${source}`);
    }
    if (!Number.isInteger(resourceId) || typeof resourceId !== 'number' || resourceId <= 0) {
        errors.push(`${context}.resourceId must be a positive integer`);
    } else if (resourceId !== expectation.resourceId) {
        errors.push(`${context}.resourceId does not match ${source}`);
    }
    if (!isHttpsUrl(upstreamReference)) {
        errors.push(`${context}.upstreamReference must be an HTTPS URL`);
    } else if (upstreamReference !== RESOURCE_CATALOG_URL) {
        errors.push(`${context}.upstreamReference must identify the official Quran.com resource catalog`);
    }
    if (editionLabel !== expectation.editionLabel) {
        errors.push(`${context}.editionLabel must preserve the reviewed catalog label and unresolved edition details`);
    }
    const retrievedDateIsValid = isValidIsoDate(retrievedAt);
    if (!retrievedDateIsValid) {
        errors.push(`${context}.retrievedAt must use YYYY-MM-DD`);
    } else if (retrievedAt > currentUtcDate) {
        errors.push(`${context}.retrievedAt must not be after the current UTC date`);
    }
    if (corpusPath !== expectation.corpusPath) {
        errors.push(`${context}.corpusPath does not match ${source}`);
    }
    if (!SHA256.test(aggregateSha256)) {
        errors.push(`${context}.aggregateSha256 must be 64 lowercase hexadecimal characters`);
    }

    const redistributionBasis = parseRedistributionBasis(
        input.redistributionBasis,
        currentUtcDate,
        `${context}.redistributionBasis`,
        errors,
    );
    const integrity = parseIntegrity(input.integrity, expectation, `${context}.integrity`, errors);
    const files = parseFiles(input.files, expectation.corpusPath, `${context}.files`, errors);
    if (files.length === EXPECTED_FILE_COUNT
        && SHA256.test(aggregateSha256)
        && computeAggregateSha256(files) !== aggregateSha256) {
        errors.push(`${context}.aggregateSha256 does not match the deterministic file aggregate`);
    }

    if (!redistributionBasis || !integrity) {
        return undefined;
    }
    if (sourceTitle !== expectation.sourceTitle
        || language !== expectation.language
        || resourceId !== expectation.resourceId
        || upstreamReference !== RESOURCE_CATALOG_URL
        || editionLabel !== expectation.editionLabel
        || !retrievedDateIsValid
        || retrievedAt > currentUtcDate
        || corpusPath !== expectation.corpusPath
        || files.length !== EXPECTED_FILE_COUNT
        || !SHA256.test(aggregateSha256)
        || computeAggregateSha256(files) !== aggregateSha256) {
        return undefined;
    }

    return {
        source,
        sourceTitle,
        language: expectation.language,
        resourceId: expectation.resourceId,
        upstreamReference,
        editionLabel,
        retrievedAt,
        redistributionBasis,
        corpusPath,
        integrity,
        files,
        aggregateSha256,
    };
}

export function computeFileSha256(data: string | Buffer): string {
    return createHash('sha256').update(data).digest('hex');
}

export function computeAggregateSha256(files: readonly ProvenanceFile[]): string {
    const payload = [...files]
        .sort((left, right) => left.path.localeCompare(right.path, 'en'))
        .map(file => `${file.path}\0${file.sha256.toLowerCase()}\n`)
        .join('');
    return computeFileSha256(payload);
}

export function validateProvenance(
    input: unknown,
    validationOptions: ProvenanceValidationOptions,
): ProvenanceValidationResult {
    if (!isRecord(validationOptions)
        || typeof validationOptions.currentUtcDate !== 'string'
        || !isValidIsoDate(validationOptions.currentUtcDate)) {
        return { errors: ['validationOptions.currentUtcDate must use YYYY-MM-DD'] };
    }
    if (!isRecord(input)) {
        return { errors: ['manifest must be an object'] };
    }

    const errors: string[] = [];
    validateFields(input, [
        'schemaVersion',
        'aggregateHashMethod',
        'publicActivationApproved',
        'activationBlockers',
        'sources',
    ], 'manifest', errors);

    if (input.schemaVersion !== 1) {
        errors.push('manifest.schemaVersion must be 1');
    }
    if (input.aggregateHashMethod !== AGGREGATE_HASH_METHOD) {
        errors.push('manifest.aggregateHashMethod must match the supported deterministic method');
    }
    if (input.publicActivationApproved !== false) {
        errors.push('manifest public activation is not approved because redistribution and ML-use rights are not proven');
    }

    const activationBlockers: ActivationBlocker[] = [];
    if (!Array.isArray(input.activationBlockers)) {
        if (input.activationBlockers !== undefined) {
            errors.push('manifest.activationBlockers must be an array');
        }
    } else {
        const blockerSet = new Set(input.activationBlockers);
        for (const blocker of REQUIRED_ACTIVATION_BLOCKERS) {
            if (!blockerSet.has(blocker)) {
                errors.push(`manifest.activationBlockers is missing required blocker ${blocker}`);
            } else {
                activationBlockers.push(blocker);
            }
        }
        for (const blocker of input.activationBlockers) {
            if (typeof blocker !== 'string') {
                errors.push('manifest.activationBlockers contains unsupported non-string blocker');
            } else if (!(REQUIRED_ACTIVATION_BLOCKERS as readonly string[]).includes(blocker)) {
                errors.push(`manifest.activationBlockers contains unsupported blocker ${blocker}`);
            }
        }
        if (blockerSet.size !== input.activationBlockers.length) {
            errors.push('manifest.activationBlockers must not contain duplicates');
        }
    }

    const sources: CorpusProvenanceSource[] = [];
    if (!Array.isArray(input.sources)) {
        if (input.sources !== undefined) {
            errors.push('manifest.sources must be an array');
        }
    } else {
        if (input.sources.length !== 2) {
            errors.push('manifest.sources must contain exactly two sources');
        }
        const rawResourceIds = input.sources
            .filter(isRecord)
            .map(source => source.resourceId)
            .filter((resourceId): resourceId is number => typeof resourceId === 'number');
        if (new Set(rawResourceIds).size !== rawResourceIds.length) {
            errors.push('manifest.sources contains a duplicate resourceId conflict');
        }
        for (let index = 0; index < input.sources.length; index += 1) {
            const source = parseSource(
                input.sources[index],
                index,
                validationOptions.currentUtcDate,
                errors,
            );
            if (source) {
                sources.push(source);
            }
        }
    }

    const sourceIds = sources.map(source => source.source);
    if (new Set(sourceIds).size !== sourceIds.length) {
        errors.push('manifest.sources contains a duplicate source');
    }
    if (sources.length === 2
        && (sources[0]?.source !== 'ibn_kathir_en_abridged' || sources[1]?.source !== 'al_sadi_ar')) {
        errors.push('manifest.sources must use the reviewed deterministic source order');
    }

    if (errors.length > 0) {
        return { errors };
    }
    return {
        errors,
        manifest: {
            schemaVersion: 1,
            aggregateHashMethod: AGGREGATE_HASH_METHOD,
            publicActivationApproved: false,
            activationBlockers,
            sources,
        },
    };
}
