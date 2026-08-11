import * as assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import {
    AGGREGATE_HASH_METHOD,
    computeAggregateSha256,
    computeFileSha256,
    validateProvenance,
} from '../../src/noor-rag/provenance';

const REPOSITORY_ROOT = resolve(__dirname, '../../../..');
const MANIFEST_PATH = resolve(REPOSITORY_ROOT, 'docs/noor-rag/corpus-provenance.json');
const SHA256 = /^[a-f0-9]{64}$/;
const CONTROLLED_CURRENT_UTC_DATE = '2026-08-11';

function loadManifest(): unknown {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as unknown;
}

function cloneManifest(): Record<string, unknown> {
    return JSON.parse(JSON.stringify(loadManifest())) as Record<string, unknown>;
}

function manifestSources(manifest: Record<string, unknown>): Array<Record<string, unknown>> {
    const sources = manifest.sources;
    assert.ok(Array.isArray(sources));
    return sources as Array<Record<string, unknown>>;
}

function sourceFiles(source: Record<string, unknown>): Array<Record<string, unknown>> {
    const files = source.files;
    assert.ok(Array.isArray(files));
    return files as Array<Record<string, unknown>>;
}

function validateManifest(
    manifest: unknown,
    currentUtcDate = CONTROLLED_CURRENT_UTC_DATE,
): ReturnType<typeof validateProvenance> {
    return validateProvenance(manifest, { currentUtcDate });
}

function expectInvalid(manifest: unknown, pattern: RegExp): void {
    const result = validateManifest(manifest);
    assert.ok(
        result.errors.some(error => pattern.test(error)),
        `Expected an error matching ${String(pattern)}, received: ${result.errors.join('; ')}`,
    );
}

describe('corpus provenance manifest', () => {
    it('validates the reviewed two-source manifest', () => {
        const manifest = loadManifest();
        const result = validateManifest(manifest);

        assert.deepEqual(result.errors, []);
        assert.ok(result.manifest);
        assert.equal(result.manifest.sources.length, 2);
        assert.equal(new Set(result.manifest.sources.map(source => source.resourceId)).size, 2);
        assert.ok(result.manifest.sources.every(source => (
            Number.isInteger(source.resourceId) && source.resourceId > 0
        )));
        assert.equal(result.manifest.publicActivationApproved, false);
    });

    it('locks the live Quran.com source identities and keeps activation closed', () => {
        const result = validateManifest(loadManifest());
        assert.ok(result.manifest);

        assert.deepEqual(
            result.manifest.sources.map(source => ({
                source: source.source,
                sourceTitle: source.sourceTitle,
                language: source.language,
                resourceId: source.resourceId,
                editionLabel: source.editionLabel,
            })),
            [
                {
                    source: 'ibn_kathir_en_abridged',
                    sourceTitle: 'Ibn Kathir (Abridged)',
                    language: 'en',
                    resourceId: 169,
                    editionLabel: 'Quran.com catalog: Ibn Kathir (Abridged), English; translator, publisher, edition, and revision not stated',
                },
                {
                    source: 'al_sadi_ar',
                    sourceTitle: "السعدي Al-Sa'di",
                    language: 'ar',
                    resourceId: 91,
                    editionLabel: "Quran.com catalog: السعدي Al-Sa'di, Arabic; translator, publisher, edition, and revision not stated",
                },
            ],
        );
        assert.ok(result.manifest.sources.every(source => (
            source.redistributionBasis.status === 'not_proven_for_public_commercial_redistribution'
        )));
        assert.equal(result.manifest.publicActivationApproved, false);
    });

    it('defines and applies a deterministic aggregate hash over sorted path/hash records', () => {
        const files = [
            { path: 'surah_002.json', sha256: 'b'.repeat(64) },
            { path: 'surah_001.json', sha256: 'a'.repeat(64) },
        ];
        const expectedPayload = [
            `surah_001.json\0${'a'.repeat(64)}\n`,
            `surah_002.json\0${'b'.repeat(64)}\n`,
        ].join('');
        const expected = createHash('sha256').update(expectedPayload, 'utf8').digest('hex');

        assert.equal(
            AGGREGATE_HASH_METHOD,
            'sha256-utf8(sorted-by-path(path + "\\u0000" + lowercase-file-sha256 + "\\n"))',
        );
        assert.equal(computeAggregateSha256(files), expected);
        assert.equal(computeAggregateSha256([...files].reverse()), expected);
    });

    it('contains exactly 114 correctly named hashes per source and matches committed bytes', () => {
        const result = validateManifest(loadManifest());
        assert.ok(result.manifest);

        for (const source of result.manifest.sources) {
            assert.equal(source.files.length, 114);
            assert.match(source.aggregateSha256, SHA256);
            let affectedFileCount = 0;
            let replacementCharacterCount = 0;

            for (let surah = 1; surah <= 114; surah += 1) {
                const file = source.files[surah - 1];
                assert.ok(file);
                assert.equal(file.path, `${source.corpusPath}/surah_${String(surah).padStart(3, '0')}.json`);
                assert.match(file.sha256, SHA256);
                const fileBytes = readFileSync(resolve(REPOSITORY_ROOT, file.path));
                assert.equal(
                    file.sha256,
                    computeFileSha256(fileBytes),
                );
                const matches = fileBytes.toString('utf8').match(/\uFFFD/g) ?? [];
                if (matches.length > 0) {
                    affectedFileCount += 1;
                    replacementCharacterCount += matches.length;
                }
            }

            assert.equal(source.aggregateSha256, computeAggregateSha256(source.files));
            assert.equal(source.integrity.hashScope, 'exact_committed_bytes');
            assert.equal(source.integrity.currentApiEqualityVerified, true);
            assert.equal(source.integrity.affectedFileCount, affectedFileCount);
            assert.equal(source.integrity.replacementCharacterCount, replacementCharacterCount);
        }
    });

    it('fails closed on missing and unknown fields at every manifest level', () => {
        const missingTopLevel = cloneManifest();
        delete missingTopLevel.aggregateHashMethod;
        expectInvalid(missingTopLevel, /aggregateHashMethod.*required/i);

        const unknownTopLevel = cloneManifest();
        unknownTopLevel.unreviewed = true;
        expectInvalid(unknownTopLevel, /unknown field.*unreviewed/i);

        const missingSourceField = cloneManifest();
        delete manifestSources(missingSourceField)[0]?.editionLabel;
        expectInvalid(missingSourceField, /editionLabel.*required/i);

        const unknownSourceField = cloneManifest();
        const firstSource = manifestSources(unknownSourceField)[0];
        assert.ok(firstSource);
        firstSource.unreviewed = true;
        expectInvalid(unknownSourceField, /unknown field.*unreviewed/i);

        const unknownFileField = cloneManifest();
        const firstUnknownFile = sourceFiles(manifestSources(unknownFileField)[0] ?? {})[0];
        assert.ok(firstUnknownFile);
        firstUnknownFile.size = 1;
        expectInvalid(unknownFileField, /unknown field.*size/i);

        const unknownBasisField = cloneManifest();
        const basisSource = manifestSources(unknownBasisField)[0];
        assert.ok(basisSource);
        const basis = basisSource.redistributionBasis;
        assert.ok(typeof basis === 'object' && basis !== null && !Array.isArray(basis));
        (basis as Record<string, unknown>).permissionInferred = true;
        expectInvalid(unknownBasisField, /unknown field.*permissionInferred/i);

        const unknownIntegrityField = cloneManifest();
        const integritySource = manifestSources(unknownIntegrityField)[0];
        assert.ok(integritySource);
        const integrity = integritySource.integrity;
        assert.ok(typeof integrity === 'object' && integrity !== null && !Array.isArray(integrity));
        (integrity as Record<string, unknown>).normalized = true;
        expectInvalid(unknownIntegrityField, /unknown field.*normalized/i);
    });

    it('rejects duplicate or conflicting resource IDs', () => {
        const duplicate = cloneManifest();
        const duplicateSources = manifestSources(duplicate);
        assert.ok(duplicateSources[0] && duplicateSources[1]);
        duplicateSources[1].resourceId = duplicateSources[0].resourceId;
        expectInvalid(duplicate, /duplicate resourceId/i);

        const russianAlSadi = cloneManifest();
        const alSadi = manifestSources(russianAlSadi)[1];
        assert.ok(alSadi);
        alSadi.resourceId = 170;
        expectInvalid(russianAlSadi, /resourceId.*al_sadi_ar/i);
    });

    it('rejects wrong file counts, names, hashes, and aggregate hashes', () => {
        const wrongCount = cloneManifest();
        sourceFiles(manifestSources(wrongCount)[0] ?? {}).pop();
        expectInvalid(wrongCount, /exactly 114 files/i);

        const wrongName = cloneManifest();
        const wrongNameFile = sourceFiles(manifestSources(wrongName)[0] ?? {})[0];
        assert.ok(wrongNameFile);
        wrongNameFile.path = 'surah_001.json';
        expectInvalid(wrongName, /unexpected file path/i);

        const malformedHash = cloneManifest();
        const malformedHashFile = sourceFiles(manifestSources(malformedHash)[0] ?? {})[0];
        assert.ok(malformedHashFile);
        malformedHashFile.sha256 = 'not-a-hash';
        expectInvalid(malformedHash, /sha256.*64 lowercase hexadecimal/i);

        const aggregateMismatch = cloneManifest();
        const aggregateSource = manifestSources(aggregateMismatch)[0];
        assert.ok(aggregateSource);
        aggregateSource.aggregateSha256 = '0'.repeat(64);
        expectInvalid(aggregateMismatch, /aggregateSha256.*does not match/i);
    });

    it('rejects unsupported source, title, language, dates, and URLs', () => {
        const unsupportedSource = cloneManifest();
        const source = manifestSources(unsupportedSource)[0];
        assert.ok(source);
        source.source = 'unknown';
        expectInvalid(unsupportedSource, /unsupported source/i);

        const wrongTitle = cloneManifest();
        const titleSource = manifestSources(wrongTitle)[0];
        assert.ok(titleSource);
        titleSource.sourceTitle = 'A guessed title';
        expectInvalid(wrongTitle, /sourceTitle.*ibn_kathir_en_abridged/i);

        const wrongLanguage = cloneManifest();
        const languageSource = manifestSources(wrongLanguage)[1];
        assert.ok(languageSource);
        languageSource.language = 'en';
        expectInvalid(wrongLanguage, /language.*al_sadi_ar/i);

        const invalidDate = cloneManifest();
        const dateSource = manifestSources(invalidDate)[0];
        assert.ok(dateSource);
        dateSource.retrievedAt = '08/11/2026';
        expectInvalid(invalidDate, /retrievedAt.*YYYY-MM-DD/i);

        const insecureUrl = cloneManifest();
        const urlSource = manifestSources(insecureUrl)[0];
        assert.ok(urlSource);
        urlSource.upstreamReference = 'http://api.quran.com/resources';
        expectInvalid(insecureUrl, /upstreamReference.*HTTPS URL/i);

        const nonPrimaryUrl = cloneManifest();
        const nonPrimarySource = manifestSources(nonPrimaryUrl)[0];
        assert.ok(nonPrimarySource);
        nonPrimarySource.upstreamReference = 'https://example.com/resources';
        expectInvalid(nonPrimaryUrl, /upstreamReference.*official Quran/i);
    });

    it('accepts current-day and past evidence dates against an injected UTC day', () => {
        const manifest = cloneManifest();
        const sources = manifestSources(manifest);
        const currentDaySource = sources[0];
        const pastSource = sources[1];
        assert.ok(currentDaySource && pastSource);
        currentDaySource.retrievedAt = CONTROLLED_CURRENT_UTC_DATE;
        pastSource.retrievedAt = '2026-08-10';

        const currentDayBasis = currentDaySource.redistributionBasis;
        const pastBasis = pastSource.redistributionBasis;
        assert.ok(typeof currentDayBasis === 'object' && currentDayBasis !== null && !Array.isArray(currentDayBasis));
        assert.ok(typeof pastBasis === 'object' && pastBasis !== null && !Array.isArray(pastBasis));
        (currentDayBasis as Record<string, unknown>).termsLastUpdated = CONTROLLED_CURRENT_UTC_DATE;
        (pastBasis as Record<string, unknown>).termsLastUpdated = '2026-08-09';

        assert.deepEqual(validateManifest(manifest).errors, []);
    });

    it('rejects future retrieved and terms dates against an injected UTC day', () => {
        const futureRetrieval = cloneManifest();
        const retrievalSource = manifestSources(futureRetrieval)[0];
        assert.ok(retrievalSource);
        retrievalSource.retrievedAt = '2026-08-12';
        const retrievalResult = validateManifest(futureRetrieval);
        assert.match(retrievalResult.errors.join('; '), /retrievedAt.*after.*current UTC date/i);

        const futureTerms = cloneManifest();
        const termsSource = manifestSources(futureTerms)[0];
        assert.ok(termsSource);
        const basis = termsSource.redistributionBasis;
        assert.ok(typeof basis === 'object' && basis !== null && !Array.isArray(basis));
        (basis as Record<string, unknown>).termsLastUpdated = '2026-08-12';
        const termsResult = validateManifest(futureTerms);
        assert.match(termsResult.errors.join('; '), /termsLastUpdated.*after.*current UTC date/i);
    });

    it('fails closed when the injected current UTC day is invalid', () => {
        const result = validateManifest(loadManifest(), '2026-02-30');

        assert.deepEqual(result, {
            errors: ['validationOptions.currentUtcDate must use YYYY-MM-DD'],
        });
    });

    it('rejects malformed redistribution evidence and unsafe activation claims', () => {
        const missingBasis = cloneManifest();
        const missingBasisSource = manifestSources(missingBasis)[0];
        assert.ok(missingBasisSource);
        delete missingBasisSource.redistributionBasis;
        expectInvalid(missingBasis, /redistributionBasis.*required/i);

        const approvedWithoutRights = cloneManifest();
        approvedWithoutRights.publicActivationApproved = true;
        expectInvalid(approvedWithoutRights, /public activation.*not proven/i);

        const blockersRemoved = cloneManifest();
        blockersRemoved.activationBlockers = [];
        expectInvalid(blockersRemoved, /activationBlockers.*required blocker/i);

        const inferredAvailability = cloneManifest();
        const inferredSource = manifestSources(inferredAvailability)[0];
        assert.ok(inferredSource);
        const basis = inferredSource.redistributionBasis;
        assert.ok(typeof basis === 'object' && basis !== null && !Array.isArray(basis));
        (basis as Record<string, unknown>).status = 'approved_because_publicly_available';
        expectInvalid(inferredAvailability, /redistributionBasis\.status.*unsupported/i);

        const currentContentClaim = cloneManifest();
        const currentContentSource = manifestSources(currentContentClaim)[0];
        assert.ok(currentContentSource);
        const integrity = currentContentSource.integrity;
        assert.ok(typeof integrity === 'object' && integrity !== null && !Array.isArray(integrity));
        (integrity as Record<string, unknown>).currentApiEqualityVerified = false;
        expectInvalid(currentContentClaim, /current API equality.*verified/i);
    });

    it('returns structured errors for non-string activation blockers without coercing them', () => {
        const malformedBlockers: unknown[] = [
            { toString: null, valueOf: null },
            [],
            null,
            42,
        ];

        for (const malformedBlocker of malformedBlockers) {
            const manifest = cloneManifest();
            const blockers = manifest.activationBlockers;
            assert.ok(Array.isArray(blockers));
            blockers.push(malformedBlocker);

            let result: ReturnType<typeof validateProvenance> | undefined;
            assert.doesNotThrow(() => {
                result = validateManifest(manifest);
            });
            assert.ok(result);
            assert.match(result.errors.join('; '), /unsupported non-string blocker/i);
        }
    });

    it('rejects non-object input without throwing', () => {
        assert.deepEqual(validateManifest(null), {
            errors: ['manifest must be an object'],
        });
        assert.deepEqual(validateManifest([]), {
            errors: ['manifest must be an object'],
        });
    });
});
