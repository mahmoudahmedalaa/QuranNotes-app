import * as assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import * as answerabilityModule from '../../src/noor-rag/answerability';
import { buildGroundedPrompt, generateGroundedAnswer, type GenerationProvider } from '../../src/noor-rag/generation';
import {
    buildChatQueryPlan,
    createValidatedConversationState,
    type ChatQueryPlan,
    type ValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import * as retrievalModule from '../../src/noor-rag/retrieval';
import { buildSynthesisCoverageRequirement } from '../../src/noor-rag/synthesisCoverage';
import type { RetrievalRepository, StoredDocument } from '../../src/noor-rag/retrieval';
import type { NoorAnswer, NoorChatRequest, NoorSource, RetrievedEvidence, TafsirChunk, TafsirUnit } from '../../src/noor-rag/types';

const VERSION = '2026-08-10-v1';
const REQUEST_ID = '70000000-0000-4000-8000-000000000001';
const SOURCES: readonly NoorSource[] = ['ibn_kathir_en_abridged', 'al_sadi_ar'];
const QUALITY_PASS = JSON.stringify({
    grounded: true,
    answersQuestion: true,
    preservesMaterialQualifications: true,
    materiallyMisleading: false,
    clear: true,
    citationConsistent: true,
});

class SequenceProvider implements GenerationProvider {
    readonly requests: Array<Parameters<GenerationProvider['generate']>[0]> = [];
    constructor(private readonly results: string[]) {}
    async generate(input: Parameters<GenerationProvider['generate']>[0]): Promise<string> {
        this.requests.push(input);
        const result = this.results.shift();
        if (result === undefined) throw new Error('fixture exhausted');
        return result;
    }
}

interface QuranSurahEntity {
    entityType: 'surah';
    surahNumber: number;
    canonicalName: string;
    verseCount: number;
}

interface SynthesisTaskPlan extends ChatQueryPlan {
    taskType: 'point_question' | 'entity_summary' | 'contextual_followup';
    retrievalTask: 'point_question' | 'entity_summary';
    entity: QuranSurahEntity | null;
}

interface EntitySummaryRetrievalResult {
    evidence: readonly RetrievedEvidence[];
    candidateCount: number;
    anchorVerses: readonly number[];
}

type EntitySummaryRetriever = (input: Readonly<{
    entity: QuranSurahEntity;
    config: NoorRuntimeConfig;
    repository: RetrievalRepository;
}>) => Promise<EntitySummaryRetrievalResult>;

function request(question: string, history: NoorChatRequest['history'] = []): NoorChatRequest {
    return { mode: 'chat', requestId: REQUEST_ID, question, history };
}

function taskPlan(question: string, state?: ValidatedConversationState | null, history: NoorChatRequest['history'] = []): SynthesisTaskPlan {
    return buildChatQueryPlan({ request: request(question, history), validatedConversationState: state }) as SynthesisTaskPlan;
}

function chunk(source: NoorSource, surah: number, verse: number, suffix = ''): TafsirChunk {
    const text = `Representative tafsir for Quran ${surah}:${verse} ${suffix}`.trim();
    return {
        chunkId: `c-${source}-${surah}-${verse}${suffix}`,
        canonicalUnitId: `u-${source}-${surah}-${verse}`,
        chunkIndex: 0,
        source,
        sourceTitle: source === 'al_sadi_ar' ? "Tafsir Al-Sa'di" : 'Tafsir Ibn Kathir',
        language: source === 'al_sadi_ar' ? 'ar' : 'en',
        surah,
        verseStart: verse,
        verseEnd: verse,
        originalStart: 0,
        originalEnd: text.length,
        originalText: text,
        retrievalText: text,
        corpusVersion: VERSION,
        contentHash: `hash-${source}-${surah}-${verse}${suffix}`,
        tokenCount: 8,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
}

function evidence(source: NoorSource, surah: number, verse: number, index = 1): RetrievedEvidence {
    return { kind: 'exact', promptSourceId: `S${index}`, chunk: chunk(source, surah, verse) };
}

function rangedEvidence(
    source: NoorSource,
    surah: number,
    verseStart: number,
    verseEnd: number,
    index: number,
): RetrievedEvidence {
    const item = evidence(source, surah, verseStart, index);
    return {
        ...item,
        chunk: {
            ...item.chunk,
            chunkId: `${item.chunk.chunkId}-${verseEnd}`,
            canonicalUnitId: `${item.chunk.canonicalUnitId}-${verseEnd}`,
            verseEnd,
        },
    };
}

function answered(requestId: string, item: RetrievedEvidence): NoorAnswer {
    return {
        requestId,
        status: 'answered',
        answer: 'Grounded entity introduction. [S1]',
        citations: [{
            chunkId: item.chunk.chunkId,
            canonicalUnitId: item.chunk.canonicalUnitId,
            source: item.chunk.source,
            sourceTitle: item.chunk.sourceTitle,
            surah: item.chunk.surah,
            verseStart: item.chunk.verseStart,
            verseEnd: item.chunk.verseEnd,
            corpusVersion: item.chunk.corpusVersion,
        }],
    };
}

function validatedEntityState(priorQuestion: string, surah: number): ValidatedConversationState {
    const item = evidence('ibn_kathir_en_abridged', surah, 1);
    const state = createValidatedConversationState({
        request: request(priorQuestion),
        response: answered(REQUEST_ID, item),
        evidence: [item],
    });
    assert.ok(state);
    return state;
}

function config(): NoorRuntimeConfig {
    return {
        enabled: true,
        publicEnabled: true,
        ownerUids: [],
        activeCorpusVersion: VERSION,
        promptVersion: 'synthesis-test',
        generationModel: 'gemini-3.5-flash-lite',
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
        pseudonymKeyVersion: 'test',
        sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
        maxChunksPerSource: 4,
        maxEvidenceCharacters: 50_000,
    };
}

function unitFor(value: TafsirChunk): TafsirUnit {
    return {
        canonicalUnitId: value.canonicalUnitId,
        source: value.source,
        sourceTitle: value.source === 'al_sadi_ar' ? "Tafsir Al-Sa'di" : 'Tafsir Ibn Kathir',
        language: value.language,
        surah: value.surah,
        verseStart: value.verseStart,
        verseEnd: value.verseEnd,
        originalText: value.originalText,
        retrievalText: value.retrievalText,
        corpusVersion: value.corpusVersion,
        contentHash: value.contentHash,
        resourceId: 1,
        upstreamReference: 'https://example.test/tafsir',
        editionLabel: 'fixture',
        normalizationVersion: 'html-entities-nfc-whitespace-v1',
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
}

function entityRepository(surah: number, anchors: readonly number[]): RetrievalRepository {
    const documents = new Map<string, StoredDocument>();
    for (const source of SOURCES) {
        for (const [anchorIndex, verse] of anchors.entries()) {
            const value = chunk(source, surah, verse, anchorIndex % 4 === 1
                ? ' recurring guidance covenant mercy'
                : ` isolated-detail-${anchorIndex}`);
            const unit = unitFor(value);
            const lookupId = `${source}_${surah}_${verse}`;
            documents.set(`corpora/${VERSION}/verseLookup/${lookupId}`, {
                id: lookupId,
                data: {
                    lookupId,
                    source,
                    surah,
                    verse,
                    canonicalUnitId: unit.canonicalUnitId,
                    chunkIds: [value.chunkId],
                    corpusVersion: VERSION,
                },
            });
            documents.set(`corpora/${VERSION}/units/${unit.canonicalUnitId}`, { id: unit.canonicalUnitId, data: unit });
            documents.set(`corpora/${VERSION}/chunks/${value.chunkId}`, { id: value.chunkId, data: value });
        }
    }
    return {
        readDocument: async path => documents.get(path) ?? null,
        readDocuments: async paths => paths.flatMap(path => {
            const value = documents.get(path);
            return value ? [value] : [];
        }),
        searchChunks: async () => {
            throw new Error('Entity synthesis must not use unrestricted global vector retrieval');
        },
    };
}

describe('Noor entity-summary task routing', () => {
    it('classifies representative direct synthesis questions and resolves canonical surahs', () => {
        const cases = [
            ['What are the main themes of Surah Al-Baqarah?', 2, 'Al-Baqarah'],
            ['Summarize Surah Yusuf.', 12, 'Yusuf'],
            ['What is Surah Maryam mainly about?', 19, 'Maryam'],
            ['Give me an overview of Surah Al-Kahf.', 18, 'Al-Kahf'],
            ['What lessons can we learn from Surah Nuh?', 71, 'Nuh'],
        ] as const;

        for (const [question, surahNumber, canonicalName] of cases) {
            const plan = taskPlan(question);
            assert.equal(plan.taskType, 'entity_summary', question);
            assert.equal(plan.retrievalTask, 'entity_summary', question);
            assert.deepEqual(plan.entity && {
                entityType: plan.entity.entityType,
                surahNumber: plan.entity.surahNumber,
                canonicalName: plan.entity.canonicalName,
            }, { entityType: 'surah', surahNumber, canonicalName }, question);
            assert.equal(plan.requiresClarification, false, question);
        }
    });

    it('keeps verified point questions on the existing narrow path', () => {
        for (const question of [
            'What does the Quran say about riba?',
            'Summarize what the Quran says about riba.',
            'Give me an overview of zakat.',
            'Summarize the Quran.',
            'What are the main themes of the Quran?',
            'Tell me about Noah.',
            'Can you pray without wudu?',
            'What does verse 2:275 mean?',
        ]) {
            const plan = taskPlan(question);
            assert.equal(plan.taskType, 'point_question', question);
            assert.equal(plan.retrievalTask, 'point_question', question);
            assert.equal(plan.entity, null, question);
            assert.deepEqual(plan.variants, [{ kind: 'original', query: question }], question);
        }
    });

    it('persists a cited canonical surah entity and combines it with a synthesis follow-up', () => {
        const cases = [
            ['Tell me about Surah Al-Baqarah.', 2, 'What are the themes?', 'Al-Baqarah'],
            ['Tell me about Surah Al-Mulk.', 67, 'What are its main themes?', 'Al-Mulk'],
        ] as const;

        for (const [priorQuestion, surahNumber, followUp, canonicalName] of cases) {
            const state = validatedEntityState(priorQuestion, surahNumber) as ValidatedConversationState & {
                entity?: QuranSurahEntity;
            };
            assert.deepEqual(state.entity && {
                entityType: state.entity.entityType,
                surahNumber: state.entity.surahNumber,
                canonicalName: state.entity.canonicalName,
            }, { entityType: 'surah', surahNumber, canonicalName });
            const plan = taskPlan(followUp, state, [{ role: 'user', content: priorQuestion }]);
            assert.equal(plan.taskType, 'contextual_followup');
            assert.equal(plan.retrievalTask, 'entity_summary');
            assert.equal(plan.entity?.surahNumber, surahNumber);
            assert.equal(plan.contextSelected, true);
            assert.equal(plan.requiresClarification, false);
        }
    });

    it('does not infer an omitted entity from synthesis wording without validated state', () => {
        for (const question of [
            'What are the themes?',
            'Please summarize the surah.',
            'Could you give me an overview of this surah?',
        ]) {
            const plan = taskPlan(question);
            assert.equal(plan.entity, null, question);
            assert.equal(plan.requiresClarification, true, question);
            assert.equal(plan.variants.length, 0, question);
        }
    });
});

describe('Noor entity-constrained coverage retrieval', () => {
    it('uses bounded cross-surah-independent anchors and selects diverse evidence from the requested surah only', async () => {
        const retrieve = (retrievalModule as unknown as {
            retrieveEntitySummaryWithStats?: EntitySummaryRetriever;
        }).retrieveEntitySummaryWithStats;
        assert.equal(typeof retrieve, 'function');
        if (!retrieve) return;

        const entity: QuranSurahEntity = {
            entityType: 'surah', surahNumber: 12, canonicalName: 'Yusuf', verseCount: 111,
        };
        const anchors = [
            3, 7, 12, 16, 21, 26, 30, 35, 40, 44, 49, 53,
            58, 63, 67, 72, 77, 81, 86, 90, 95, 100, 104, 109,
        ];
        const result = await retrieve({ entity, config: config(), repository: entityRepository(12, anchors) });

        assert.deepEqual(result.anchorVerses, anchors);
        assert.equal(result.candidateCount, 48);
        assert.equal(result.evidence.length, 8);
        assert.ok(result.evidence.every(item => item.chunk.surah === 12));
        assert.equal(new Set(result.evidence.map(item => item.chunk.canonicalUnitId)).size, 8);
        assert.equal(new Set(result.evidence.map(item => item.chunk.source)).size, 2);
        assert.equal(new Set(result.evidence.map(item => Math.floor((item.chunk.verseStart - 1) * 6 / 111))).size, 6);
        assert.ok(result.evidence.filter(item => /recurring guidance covenant mercy/u.test(item.chunk.retrievalText)).length >= 4);
    });

    it('requires same-entity, non-overlapping coverage before synthesis is answerable', () => {
        const sufficient = (answerabilityModule as unknown as {
            isEntitySummaryEvidenceSufficient?: (
                entity: QuranSurahEntity,
                evidenceValue: readonly RetrievedEvidence[],
            ) => boolean;
        }).isEntitySummaryEvidenceSufficient;
        assert.equal(typeof sufficient, 'function');
        if (!sufficient) return;

        const entity: QuranSurahEntity = {
            entityType: 'surah', surahNumber: 19, canonicalName: 'Maryam', verseCount: 98,
        };
        const distributed = [8, 25, 57, 90].map((verse, index) => (
            evidence(index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar', 19, verse, index + 1)
        ));
        const narrow = [8, 9, 10, 11].map((verse, index) => evidence('ibn_kathir_en_abridged', 19, verse, index + 1));
        const polluted = [...distributed.slice(0, 3), evidence('al_sadi_ar', 18, 90, 4)];
        const oneConcept = distributed.map(item => ({
            ...item,
            chunk: {
                ...item.chunk,
                originalText: 'The same single narrow property repeated in every section.',
                retrievalText: 'The same single narrow property repeated in every section.',
            },
        }));

        assert.equal(sufficient(entity, distributed), true);
        assert.equal(sufficient(entity, narrow), false);
        assert.equal(sufficient(entity, polluted), false);
        assert.equal(sufficient(entity, oneConcept), false);
    });
});

describe('Noor synthesis generation contract', () => {
    it('tells generation to synthesize entity-wide evidence instead of substituting a nearby property', () => {
        const directPlan = taskPlan('What are the main themes of Surah Al-Baqarah?');
        const build = buildGroundedPrompt as unknown as (
            requestValue: NoorChatRequest,
            evidenceValue: readonly RetrievedEvidence[],
            maximumCharacters: number,
            plan: SynthesisTaskPlan,
        ) => ReturnType<typeof buildGroundedPrompt>;
        const prompt = build(
            request('What are the main themes of Surah Al-Baqarah?'),
            [evidence('ibn_kathir_en_abridged', 2, 1)],
            50_000,
            directPlan,
        ).prompt;

        assert.match(prompt, /<taskType>entity_summary<\/taskType>/);
        assert.match(prompt, /same entity or topic.*not.*fulfill/iu);
        assert.match(prompt, /one narrow property.*not.*summary/iu);
        assert.match(prompt, /\[S#\].*immediately after.*summary point/iu);
        assert.match(prompt, /grouped marker.*same summary point/iu);
        assert.match(prompt, /every non-empty paragraph.*citation marker/iu);
        assert.match(prompt, /do not emit.*uncited.*introduct/iu);
    });

    it('derives an overlap-aware short-entity requirement from achievable selected evidence', () => {
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 114, 1, 6, 1),
            rangedEvidence('al_sadi_ar', 114, 2, 5, 2),
            rangedEvidence('ibn_kathir_en_abridged', 114, 6, 6, 3),
            rangedEvidence('al_sadi_ar', 114, 1, 1, 4),
        ];
        const prompt = buildGroundedPrompt(
            request('Summarize Surah Al-Nas.'),
            selected,
            50_000,
            taskPlan('Summarize Surah Al-Nas.'),
        ).prompt;

        assert.match(prompt, /<synthesisCoverageRequirement>/u);
        assert.match(prompt, /<minimumSubstantiveCitationUnits>2<\/minimumSubstantiveCitationUnits>/u);
        assert.match(prompt, /<minimumSubstantiveSummaryPoints>2<\/minimumSubstantiveSummaryPoints>/u);
        assert.match(prompt, /<minimumCoveredRegions>1<\/minimumCoveredRegions>/u);
        assert.match(prompt, /<minimumCoveredVerses>5<\/minimumCoveredVerses>/u);
        assert.match(prompt, /<availableCanonicalEvidenceUnits>4<\/availableCanonicalEvidenceUnits>/u);
        assert.match(prompt, /<availableCoveredRegions>1<\/availableCoveredRegions>/u);
        assert.match(prompt, /<coveredEntityVerses>6<\/coveredEntityVerses>/u);
        assert.match(prompt, /<coveredRegion id="R1" verseStart="1" verseEnd="6" evidenceIds="S1,S2,S3,S4"\/>/u);
    });

    it('does not mistake adjacent large-entity intervals for overlapping capacity', () => {
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 2, 1, 100, 1),
            rangedEvidence('al_sadi_ar', 2, 101, 200, 2),
            rangedEvidence('ibn_kathir_en_abridged', 2, 201, 286, 3),
        ];
        const prompt = buildGroundedPrompt(
            request('What are the main themes of Surah Al-Baqarah?'),
            selected,
            50_000,
            taskPlan('What are the main themes of Surah Al-Baqarah?'),
        ).prompt;

        assert.match(prompt, /<minimumSubstantiveCitationUnits>3<\/minimumSubstantiveCitationUnits>/u);
        assert.match(prompt, /<minimumSubstantiveSummaryPoints>3<\/minimumSubstantiveSummaryPoints>/u);
        assert.match(prompt, /<minimumCoveredRegions>3<\/minimumCoveredRegions>/u);
        assert.match(prompt, /<overlapVerseCount>0<\/overlapVerseCount>/u);
    });

    it('bounds short-entity summary points by genuinely distinct conceptual support', () => {
        const duplicateText = 'The same complete entity explanation repeated in both selected units.';
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 114, 1, 6, 1),
            rangedEvidence('al_sadi_ar', 114, 1, 6, 2),
        ].map(item => ({
            ...item,
            chunk: { ...item.chunk, originalText: duplicateText, retrievalText: duplicateText },
        }));
        const prompt = buildGroundedPrompt(
            request('Summarize Surah Al-Nas.'),
            selected,
            50_000,
            taskPlan('Summarize Surah Al-Nas.'),
        ).prompt;

        assert.match(prompt, /<availableConceptClusters>1<\/availableConceptClusters>/u);
        assert.match(prompt, /<minimumSubstantiveCitationUnits>1<\/minimumSubstantiveCitationUnits>/u);
        assert.match(prompt, /<minimumSubstantiveSummaryPoints>1<\/minimumSubstantiveSummaryPoints>/u);
    });

    it('keeps the clean compiled deployment artifact in parity with the adaptive coverage source', () => {
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 114, 1, 6, 1),
            rangedEvidence('al_sadi_ar', 114, 2, 5, 2),
            rangedEvidence('ibn_kathir_en_abridged', 114, 6, 6, 3),
            rangedEvidence('al_sadi_ar', 114, 1, 1, 4),
        ];
        const entity = taskPlan('Summarize Surah Al-Nas.').entity;
        assert.ok(entity);
        const compiled = require(resolve(process.cwd(), 'lib/noor-rag/synthesisCoverage.js')) as {
            buildSynthesisCoverageRequirement: typeof buildSynthesisCoverageRequirement;
        };

        assert.deepEqual(
            compiled.buildSynthesisCoverageRequirement(entity, selected),
            buildSynthesisCoverageRequirement(entity, selected),
        );
    });

    it('accepts two substantive supports when overlapping evidence covers the complete short entity', async () => {
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 114, 1, 6, 1),
            rangedEvidence('al_sadi_ar', 114, 2, 5, 2),
            rangedEvidence('ibn_kathir_en_abridged', 114, 6, 6, 3),
            rangedEvidence('al_sadi_ar', 114, 1, 1, 4),
        ];
        const provider = new SequenceProvider([
            JSON.stringify({
                answer: 'The passage teaches seeking refuge in Allah from evil. [S1] It identifies stealthy whispering as a danger to people. [S2]',
                citationIds: ['S1', 'S2'],
            }),
            QUALITY_PASS,
        ]);

        const response = await generateGroundedAnswer({
            request: request('Summarize Surah Al-Nas.'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('Summarize Surah Al-Nas.'),
        });

        assert.equal(response.status, 'answered');
        assert.equal(provider.requests.length, 2);
        assert.deepEqual(response.citations.map(citation => citation.verseStart), [1, 2]);
    });

    it('credits structurally equivalent grouped citations without mistaking one group for several summary points', async () => {
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 114, 1, 6, 1),
            rangedEvidence('al_sadi_ar', 114, 2, 5, 2),
            rangedEvidence('ibn_kathir_en_abridged', 114, 6, 6, 3),
            rangedEvidence('al_sadi_ar', 114, 1, 1, 4),
        ];
        const provider = new SequenceProvider([
            JSON.stringify({
                answer: 'The passage teaches seeking refuge in Allah from evil. [S1, S2] It identifies stealthy whispering as a danger to people. [S1, S2]',
                citationIds: ['S1', 'S2'],
            }),
            QUALITY_PASS,
        ]);

        const response = await generateGroundedAnswer({
            request: request('Summarize Surah Al-Nas.'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('Summarize Surah Al-Nas.'),
        });

        assert.equal(response.status, 'answered');
        assert.equal(provider.requests.length, 2);
    });

    it('rejects narrow endpoint citations that game an overlap-collapsed short-entity region', async () => {
        const selected = [
            rangedEvidence('ibn_kathir_en_abridged', 114, 1, 6, 1),
            rangedEvidence('al_sadi_ar', 114, 2, 5, 2),
            rangedEvidence('ibn_kathir_en_abridged', 114, 6, 6, 3),
            rangedEvidence('al_sadi_ar', 114, 1, 1, 4),
        ];
        const endpointOnly = JSON.stringify({
            answer: 'One point cites only the final endpoint. [S3] Another point cites only the opening endpoint. [S4]',
            citationIds: ['S3', 'S4'],
        });
        const provider = new SequenceProvider([endpointOnly, QUALITY_PASS, endpointOnly, QUALITY_PASS]);

        const response = await generateGroundedAnswer({
            request: request('Summarize Surah Al-Nas.'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('Summarize Surah Al-Nas.'),
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.deepEqual(response.citations, []);
    });

    it('applies the same distributed synthesis contract across representative long entities', async () => {
        const cases = [
            ['What are the main themes of Surah Al-Baqarah?', 2, [1, 140, 280]],
            ['Give me an overview of Surah Yusuf.', 12, [1, 55, 110]],
            ['What is Surah Maryam about?', 19, [1, 49, 98]],
            ['Give me an overview of Surah Al-Kahf.', 18, [1, 55, 110]],
            ['Summarize Surah Al-Mulk.', 67, [1, 15, 30]],
        ] as const;

        for (const [question, surah, verses] of cases) {
            const selected = verses.map((verse, index) => evidence(
                index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar',
                surah,
                verse,
                index + 1,
            ));
            const provider = new SequenceProvider([
                JSON.stringify({
                    answer: 'An opening region supports the first summary point. [S1] A middle region supports the second point. [S2] A later region supports the third point. [S3]',
                    citationIds: ['S1', 'S2', 'S3'],
                }),
                QUALITY_PASS,
            ]);

            const response = await generateGroundedAnswer({
                request: request(question),
                evidence: selected,
                maxEvidenceCharacters: 50_000,
                provider,
                taskPlan: taskPlan(question),
            });

            assert.equal(response.status, 'answered', question);
            assert.equal(provider.requests.length, 2, question);
            assert.match(provider.requests[0]?.contents ?? '', /<minimumSubstantiveCitationUnits>3<\/minimumSubstantiveCitationUnits>/u, question);
            assert.match(provider.requests[0]?.contents ?? '', /<minimumSubstantiveSummaryPoints>3<\/minimumSubstantiveSummaryPoints>/u, question);
            assert.match(provider.requests[0]?.contents ?? '', /<minimumCoveredRegions>3<\/minimumCoveredRegions>/u, question);
        }
    });

    it('strengthens the generic quality rubric for task fulfillment without adding a model call', async () => {
        const calls: string[] = [];
        const outputs = [
            JSON.stringify({ answer: 'This passage describes one virtue. [S1]', citationIds: ['S1'] }),
            JSON.stringify({
                grounded: true,
                answersQuestion: false,
                preservesMaterialQualifications: true,
                materiallyMisleading: false,
                clear: true,
                citationConsistent: true,
            }),
            JSON.stringify({ answer: 'A corrected evidence-wide synthesis. [S1]', citationIds: ['S1'] }),
            JSON.stringify({
                grounded: true,
                answersQuestion: true,
                preservesMaterialQualifications: true,
                materiallyMisleading: false,
                clear: true,
                citationConsistent: true,
            }),
        ];
        const provider: GenerationProvider = {
            generate: async input => {
                calls.push(input.contents);
                const output = outputs.shift();
                if (!output) throw new Error('fixture exhausted');
                return output;
            },
        };
        const directPlan = taskPlan('What are the main themes of Surah Al-Baqarah?');
        const generate = generateGroundedAnswer as unknown as (input: Readonly<{
            request: NoorChatRequest;
            evidence: readonly RetrievedEvidence[];
            maxEvidenceCharacters: number;
            provider: GenerationProvider;
            taskPlan: SynthesisTaskPlan;
        }>) => Promise<NoorAnswer>;

        const response = await generate({
            request: request('What are the main themes of Surah Al-Baqarah?'),
            evidence: [evidence('ibn_kathir_en_abridged', 2, 1)],
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: directPlan,
        });

        assert.equal(response.status, 'answered');
        assert.equal(calls.length, 4);
        assert.match(calls[1]!, /topically related.*task/iu);
        assert.match(calls[1]!, /compare.*must.*compare/iu);
        assert.match(calls[1]!, /summar(?:y|ize).*must.*synthesi/iu);
        assert.match(calls[1]!, /themes.*one narrow/iu);
    });

    it('rejects a one-passage synthesis even when the model judge mistakes it for task fulfillment', async () => {
        const selected = [1, 50, 100, 150, 200, 250].map((verse, index) => (
            evidence(index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar', 2, verse, index + 1)
        ));
        const outputs = [
            JSON.stringify({ answer: 'One local virtue. [S1]', citationIds: ['S1'] }),
            JSON.stringify({
                grounded: true,
                answersQuestion: true,
                preservesMaterialQualifications: true,
                materiallyMisleading: false,
                clear: true,
                citationConsistent: true,
            }),
            JSON.stringify({
                answer: 'The opening establishes guidance [S1]. A middle section develops accountability [S3]. A later section addresses community obligations [S5].',
                citationIds: ['S1', 'S3', 'S5'],
            }),
            JSON.stringify({
                grounded: true,
                answersQuestion: true,
                preservesMaterialQualifications: true,
                materiallyMisleading: false,
                clear: true,
                citationConsistent: true,
            }),
        ];
        const calls: string[] = [];
        const provider: GenerationProvider = {
            generate: async input => {
                calls.push(input.contents);
                const output = outputs.shift();
                if (!output) throw new Error('fixture exhausted');
                return output;
            },
        };

        const response = await generateGroundedAnswer({
            request: request('What are the main themes of Surah Al-Baqarah?'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('What are the main themes of Surah Al-Baqarah?'),
        });

        assert.equal(response.status, 'answered');
        assert.equal(calls.length, 4);
        assert.match(calls[2]!, /multiple distinct sections/iu);
        const initialRequirement = calls[0]!.match(/<synthesisCoverageRequirement>[\s\S]*?<\/synthesisCoverageRequirement>/u)?.[0];
        const correctionRequirement = calls[2]!.match(/<synthesisCoverageRequirement>[\s\S]*?<\/synthesisCoverageRequirement>/u)?.[0];
        assert.ok(initialRequirement);
        assert.equal(correctionRequirement, initialRequirement);
        assert.deepEqual(response.citations.map(citation => citation.verseStart), [1, 100, 200]);
    });

    it('rejects a Yusuf overview supported only by a local prison-region cluster', async () => {
        const selected = [16, 26, 50, 52, 67, 83, 100].map((verse, index) => (
            evidence(index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar', 12, verse, index + 1)
        ));
        const prisonOnly = JSON.stringify({
            answer: 'The overview is reduced to one local prison episode. [S3] Another detail stays in that same local episode. [S4]',
            citationIds: ['S3', 'S4'],
        });
        const provider = new SequenceProvider([prisonOnly, QUALITY_PASS, prisonOnly, QUALITY_PASS]);

        const response = await generateGroundedAnswer({
            request: request('Give me an overview of Surah Yusuf.'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('Give me an overview of Surah Yusuf.'),
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.deepEqual(response.citations, []);
    });

    it('fails closed when a one-theme answer pads its citation list with unrelated sections', async () => {
        const selected = [1, 50, 100, 150, 200, 250].map((verse, index) => (
            evidence(index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar', 2, verse, index + 1)
        ));
        const qualityPass = JSON.stringify({
            grounded: true,
            answersQuestion: true,
            preservesMaterialQualifications: true,
            materiallyMisleading: false,
            clear: true,
            citationConsistent: true,
        });
        const padded = JSON.stringify({
            answer: 'One narrow virtue is the main theme. [S1] [S3] [S5]',
            citationIds: ['S1', 'S3', 'S5'],
        });
        const outputs = [padded, qualityPass, padded, qualityPass];
        const provider: GenerationProvider = {
            generate: async () => {
                const output = outputs.shift();
                if (!output) throw new Error('fixture exhausted');
                return output;
            },
        };

        const response = await generateGroundedAnswer({
            request: request('What are the main themes of Surah Al-Baqarah?'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('What are the main themes of Surah Al-Baqarah?'),
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.deepEqual(response.citations, []);
    });

    it('fails closed when one substantive point groups unrelated long-entity regions', async () => {
        const selected = [1, 50, 100, 150, 200, 250].map((verse, index) => (
            evidence(index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar', 2, verse, index + 1)
        ));
        const qualityPass = JSON.stringify({
            grounded: true,
            answersQuestion: true,
            preservesMaterialQualifications: true,
            materiallyMisleading: false,
            clear: true,
            citationConsistent: true,
        });
        const groupedPadding = JSON.stringify({
            answer: 'One narrow virtue is presented as the whole summary. [S1, S3, S5]',
            citationIds: ['S1', 'S3', 'S5'],
        });
        const provider = new SequenceProvider([groupedPadding, qualityPass, groupedPadding, qualityPass]);

        const response = await generateGroundedAnswer({
            request: request('What are the main themes of Surah Al-Baqarah?'),
            evidence: selected,
            maxEvidenceCharacters: 50_000,
            provider,
            taskPlan: taskPlan('What are the main themes of Surah Al-Baqarah?'),
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.deepEqual(response.citations, []);
    });
});
