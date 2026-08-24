import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isEntitySummaryEvidenceSufficient, selectAnswerableEvidence } from '../../src/noor-rag/answerability';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import { classifyPolicy } from '../../src/noor-rag/policy';
import {
    buildChatQueryPlan,
    createValidatedConversationState,
    type ChatQueryPlan,
    type ValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import type { QuranSurahEntity } from '../../src/noor-rag/quranEntities';
import type { NoorAnswer, NoorChatRequest, NoorSource, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

const REQUEST_ID = '90000000-0000-4000-8000-000000000001';
const CONFIG: NoorRuntimeConfig = {
    enabled: true,
    publicEnabled: true,
    ownerUids: [],
    activeCorpusVersion: 'corpus-v1',
    promptVersion: 'systemic-robustness-test',
    generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
    pseudonymKeyVersion: 'test',
    sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
    maxChunksPerSource: 4,
    maxEvidenceCharacters: 50_000,
};

interface PlannedDiscourseEntity {
    id: string;
    label: string;
    kind: 'surah' | 'subject';
    surahNumber?: number;
}

type SystemicPlan = Omit<ChatQueryPlan, 'taskType' | 'retrievalTask'> & {
    taskType: 'point_question' | 'entity_summary' | 'multi_entity_comparison' | 'contextual_followup';
    retrievalTask: 'point_question' | 'entity_summary' | 'multi_entity_comparison';
    entitySet: readonly PlannedDiscourseEntity[];
    explicitEntity: boolean;
};

interface SystemicState extends ValidatedConversationState {
    activeTask: SystemicPlan['taskType'];
    primaryEntity: PlannedDiscourseEntity | null;
    entitySet: readonly PlannedDiscourseEntity[];
    comparisonFrame: boolean;
    semanticSubject: readonly string[];
}

function request(question: string, history: NoorChatRequest['history'] = []): NoorChatRequest {
    return { mode: 'chat', requestId: REQUEST_ID, question, history };
}

function plan(question: string, state?: ValidatedConversationState | null, history: NoorChatRequest['history'] = []): SystemicPlan {
    return buildChatQueryPlan({ request: request(question, history), validatedConversationState: state }) as SystemicPlan;
}

function chunk(input: Readonly<{
    id: string;
    text: string;
    surah?: number;
    verse?: number;
    source?: NoorSource;
}>): TafsirChunk {
    const surah = input.surah ?? 2;
    const verse = input.verse ?? 1;
    const source = input.source ?? 'ibn_kathir_en_abridged';
    return {
        chunkId: input.id,
        canonicalUnitId: `unit-${input.id}`,
        chunkIndex: 0,
        source,
        sourceTitle: source === 'al_sadi_ar' ? "Tafsir Al-Sa'di" : 'Tafsir Ibn Kathir',
        language: source === 'al_sadi_ar' ? 'ar' : 'en',
        surah,
        verseStart: verse,
        verseEnd: verse,
        originalStart: 0,
        originalEnd: input.text.length,
        originalText: input.text,
        retrievalText: input.text,
        corpusVersion: 'corpus-v1',
        contentHash: `hash-${input.id}`,
        tokenCount: 8,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
}

function evidence(input: Parameters<typeof chunk>[0], index: number): RetrievedEvidence {
    return { kind: 'semantic', promptSourceId: `S${index}`, chunk: chunk(input), similarity: 0.9 };
}

function answerFor(items: readonly RetrievedEvidence[]): NoorAnswer {
    return {
        requestId: REQUEST_ID,
        status: 'answered',
        answer: items.map((item, index) => `Grounded point ${index + 1}. [S${index + 1}]`).join(' '),
        citations: items.map(item => ({
            chunkId: item.chunk.chunkId,
            canonicalUnitId: item.chunk.canonicalUnitId,
            source: item.chunk.source,
            sourceTitle: item.chunk.sourceTitle,
            surah: item.chunk.surah,
            verseStart: item.chunk.verseStart,
            verseEnd: item.chunk.verseEnd,
            corpusVersion: item.chunk.corpusVersion,
        })),
    };
}

describe('Noor systemic robustness invariants', () => {
    it('routes broad whole-Surah explanations by composition instead of curated phrases', () => {
        const cases = [
            ['What is Surah Maryam about?', 19],
            ['What can we learn from Surah Al-Kahf?', 18],
            ['Explain Al-Kahf like I know nothing about it.', 18],
            ['Summarize Surah An-Nas.', 114],
            ['Give me an overview of Surah Yusuf.', 12],
            ['Walk me through Surah Yusuf.', 12],
            ['Give me the core message of Surah Yusuf.', 12],
            ['Help me understand Surah Yusuf as a whole.', 12],
            ['Give me the gist of Surah Yusuf.', 12],
            ['What does Surah Yusuf fundamentally convey?', 12],
        ] as const;

        for (const [question, surah] of cases) {
            const result = plan(question);
            assert.equal(result.taskType, 'entity_summary', question);
            assert.equal(result.retrievalTask, 'entity_summary', question);
            assert.equal(result.entity?.surahNumber, surah, question);
            assert.equal(result.explicitEntity, true, question);
            assert.equal(result.requiresClarification, false, question);
            assert.ok(result.variants.length > 0, question);
        }

        for (const question of [
            'Summarize verse 5 of Surah Al-Kahf.',
            'Explain why verse 16 of Surah Maryam mentions her retreat.',
            'Is patience a theme in Surah Yusuf?',
            'Does Surah Yusuf mention the theme of patience?',
        ]) {
            assert.equal(plan(question).taskType, 'point_question', question);
        }
    });

    it('plans a generic two-entity request and preserves the pair across plural references', () => {
        const firstQuestion = 'How are the stories of Nuh and Musa different?';
        const firstPlan = plan(firstQuestion);
        assert.equal(firstPlan.taskType, 'multi_entity_comparison');
        assert.equal(firstPlan.retrievalTask, 'multi_entity_comparison');
        assert.deepEqual(firstPlan.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);

        const pairEvidence = [
            evidence({ id: 'nuh', text: 'Nuh called his people with patience.', surah: 71 }, 1),
            evidence({ id: 'musa', text: 'Musa confronted Pharaoh with clear signs.', surah: 20 }, 2),
        ];
        const createWithFrame = createValidatedConversationState as unknown as (input: Readonly<{
            request: NoorChatRequest;
            response: NoorAnswer;
            evidence: readonly RetrievedEvidence[];
            taskPlan: SystemicPlan;
            previousState?: ValidatedConversationState | null;
        }>) => ValidatedConversationState | null;
        const firstState = createWithFrame({
            request: request(firstQuestion),
            response: answerFor(pairEvidence),
            evidence: pairEvidence,
            taskPlan: firstPlan,
        }) as SystemicState | null;
        assert.ok(firstState);
        assert.deepEqual(firstState.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);

        const interveningQuestion = 'How did they respond when their people fought the message?';
        const interveningPlan = plan(interveningQuestion, firstState, [{ role: 'user', content: firstQuestion }]);
        assert.equal(interveningPlan.contextSelected, true);
        assert.deepEqual(interveningPlan.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
        const incidentalEvidence = [
            evidence({ id: 'fighting', text: 'The people fought against the message.', surah: 7 }, 1),
        ];
        const interveningState = createWithFrame({
            request: request(interveningQuestion, [{ role: 'user', content: firstQuestion }]),
            response: answerFor(incidentalEvidence),
            evidence: incidentalEvidence,
            taskPlan: interveningPlan,
            previousState: firstState,
        }) as SystemicState | null;
        assert.ok(interveningState);
        assert.deepEqual(interveningState.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
        assert.doesNotMatch(interveningState.entitySet.map(item => item.id).join(' '), /fight/iu);

        const pluralQuestion = 'What lessons do we learn from both their stories?';
        const pluralPlan = plan(pluralQuestion, interveningState, [{ role: 'user', content: interveningQuestion }]);
        assert.equal(pluralPlan.contextSelected, true);
        assert.equal(pluralPlan.taskType, 'multi_entity_comparison');
        assert.equal(pluralPlan.retrievalTask, 'multi_entity_comparison');
        assert.deepEqual(pluralPlan.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
    });

    it('replaces prior discourse when an explicit new topic appears', () => {
        const firstQuestion = 'How are the stories of Nuh and Musa different?';
        const firstPlan = plan(firstQuestion);
        const pairEvidence = [
            evidence({ id: 'nuh-reset', text: 'Nuh called his people.', surah: 71 }, 1),
            evidence({ id: 'musa-reset', text: 'Musa brought clear signs.', surah: 20 }, 2),
        ];
        const createWithFrame = createValidatedConversationState as unknown as (input: Readonly<{
            request: NoorChatRequest;
            response: NoorAnswer;
            evidence: readonly RetrievedEvidence[];
            taskPlan: SystemicPlan;
        }>) => ValidatedConversationState | null;
        const state = createWithFrame({
            request: request(firstQuestion), response: answerFor(pairEvidence), evidence: pairEvidence, taskPlan: firstPlan,
        });
        assert.ok(state);

        const reset = plan('Is lending at interest prohibited?', state, [{ role: 'user', content: firstQuestion }]);
        assert.equal(reset.contextSelected, false);
        assert.equal(reset.taskType, 'point_question');
        assert.deepEqual(reset.entitySet, []);
        assert.deepEqual(reset.variants, [{ kind: 'original', query: 'Is lending at interest prohibited?' }]);
    });

    it('adapts synthesis qualification to achievable entity structure', () => {
        const sufficient = isEntitySummaryEvidenceSufficient as unknown as (
            entity: QuranSurahEntity,
            items: readonly RetrievedEvidence[],
            capacity?: Readonly<{ canonicalUnits: number; sections: number; span: number }>,
        ) => boolean;
        const shortEntity: QuranSurahEntity = {
            entityType: 'surah', surahNumber: 114, canonicalName: 'An-Nas', verseCount: 6,
        };
        const shortEvidence = [1, 2, 2, 6].map((verse, index) => evidence({
            id: `short-${index}`,
            text: `Distinct short entity concept ${index}`,
            surah: 114,
            verse,
            source: index % 2 === 0 ? 'ibn_kathir_en_abridged' : 'al_sadi_ar',
        }, index + 1));
        assert.equal(sufficient(shortEntity, shortEvidence, { canonicalUnits: 4, sections: 3, span: 5 }), true);

        const longEntity: QuranSurahEntity = {
            entityType: 'surah', surahNumber: 2, canonicalName: 'Al-Baqarah', verseCount: 286,
        };
        const sparseLongEvidence = [1, 70, 150, 286].map((verse, index) => evidence({
            id: `long-${index}`,
            text: `Distinct long entity concept ${index}`,
            surah: 2,
            verse,
        }, index + 1));
        assert.equal(sufficient(longEntity, sparseLongEvidence, { canonicalUnits: 8, sections: 6, span: 285 }), false);
    });

    it('normalizes bounded normative relation terms without inventing the relation', () => {
        const prohibited = evidence({ id: 'normative-prohibited', text: 'Caldorin is prohibited because it causes harm.' }, 1);
        const unrelated = evidence({ id: 'normative-unrelated', text: 'Caldorin is described as a historical practice.' }, 1);

        assert.deepEqual(
            selectAnswerableEvidence('Is caldorin haram and why?', [prohibited], CONFIG).map(item => item.chunk.chunkId),
            ['normative-prohibited'],
        );
        assert.deepEqual(selectAnswerableEvidence('Is caldorin haram?', [unrelated], CONFIG), []);
        assert.deepEqual(
            selectAnswerableEvidence('Is caldorin allowed?', [evidence({ id: 'normative-permitted', text: 'Caldorin is permitted.' }, 1)], CONFIG)
                .map(item => item.chunk.chunkId),
            ['normative-permitted'],
        );
    });

    it('keeps equivalent general first-person grammar on the informational side of policy', () => {
        for (const question of [
            'Can you pray without purification?',
            'Can I pray without purification?',
            'Is prayer valid without purification?',
            'can i pray without wudu',
            'can i pray without wuduu',
            'can i pray wthout wudu',
            'can u pray without wudu?',
            'Can I eat during fasting?',
            'Can I give charity to my family?',
        ]) {
            assert.equal(classifyPolicy(question), 'allowed', question);
        }
        assert.equal(
            classifyPolicy('Given my pregnancy complications and medication schedule, issue a personal fasting ruling for my circumstances.'),
            'personal_ruling',
        );
        for (const question of [
            'Should I fast while pregnant?',
            'Can I fast while taking my medication?',
            'Can I pray sitting because I have a painful medical condition?',
            'Can I fast if I am pregnant?',
            'Can I fast during my pregnancy?',
            'Is this loan halal for my personal financial situation?',
            'is this loan halal for my personal financial situaton',
            'Should I reset my password given my situation?',
            'Based on my gaming setup, what should I upgrade?',
        ]) {
            assert.equal(classifyPolicy(question), 'allowed', question);
        }
        for (const question of [
            'Can someone fast if they are pregnant?',
            'Is fasting required during pregnancy?',
            'Can I eat during fasting?',
        ]) {
            assert.equal(classifyPolicy(question), 'allowed', question);
        }
    });
});
