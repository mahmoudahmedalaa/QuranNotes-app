import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyPolicy } from '../../src/noor-rag/policy';
import {
    applySemanticTaskClassification,
    buildChatQueryPlan,
    buildSemanticTaskFallbackInput,
    createValidatedConversationState,
    type ChatQueryPlan,
    type ValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import type { NoorAnswer, NoorChatRequest, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

const REQUEST_ID = '91000000-0000-4000-8000-000000000001';

function request(question: string, history: NoorChatRequest['history']): NoorChatRequest {
    return { mode: 'chat', requestId: REQUEST_ID, question, history };
}

function evidence(id: string, text: string, surah: number, index = 1): RetrievedEvidence {
    const chunk: TafsirChunk = {
        chunkId: id,
        canonicalUnitId: `unit-${id}`,
        chunkIndex: 0,
        source: index % 2 === 0 ? 'al_sadi_ar' : 'ibn_kathir_en_abridged',
        sourceTitle: index % 2 === 0 ? "Tafsir Al-Sa'di" : 'Tafsir Ibn Kathir',
        language: index % 2 === 0 ? 'ar' : 'en',
        surah,
        verseStart: 1,
        verseEnd: 1,
        originalStart: 0,
        originalEnd: text.length,
        originalText: text,
        retrievalText: text,
        corpusVersion: 'corpus-v1',
        contentHash: `hash-${id}`,
        tokenCount: 8,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    return { kind: 'semantic', promptSourceId: `S${index}`, chunk, similarity: 0.9 };
}

function answered(items: readonly RetrievedEvidence[]): NoorAnswer {
    return {
        requestId: REQUEST_ID,
        status: 'answered',
        answer: items.map((item, index) => `Grounded ${item.chunk.chunkId}. [S${index + 1}]`).join(' '),
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

describe('Noor mixed-conversation transcript', () => {
    it('keeps task, entity, reference, reset, policy, and non-answer invariants across eleven turns', () => {
        let state: ValidatedConversationState | null = null;
        let priorUserQuestion: string | null = null;
        const plans: ChatQueryPlan[] = [];
        let persistedTurns = 0;

        const runAnswered = (question: string, items: readonly RetrievedEvidence[]): ChatQueryPlan => {
            const history = priorUserQuestion ? [{ role: 'user' as const, content: priorUserQuestion }] : [];
            const currentRequest = request(question, history);
            const taskPlan = buildChatQueryPlan({ request: currentRequest, validatedConversationState: state });
            const next = createValidatedConversationState({
                request: currentRequest,
                response: answered(items),
                evidence: items,
                taskPlan,
                previousState: state,
            });
            assert.ok(next, question);
            state = next;
            priorUserQuestion = question;
            plans.push(taskPlan);
            persistedTurns += 1;
            return taskPlan;
        };

        const maryam = runAnswered('What is Surah Maryam about?', [evidence('maryam', 'Maryam summary evidence', 19)]);
        const kahf = runAnswered('Explain Surah Al-Kahf like I know nothing about it.', [evidence('kahf', 'Al-Kahf summary evidence', 18)]);
        const nas = runAnswered('Summarize Surah An-Nas.', [evidence('nas', 'An-Nas summary evidence', 114)]);
        const nuh = runAnswered('Tell me about Prophet Nuh.', [evidence('nuh', 'Nuh story evidence', 71)]);
        const him = runAnswered('What happened to him next?', [evidence('nuh-next', 'Nuh continued calling his people', 71)]);
        const comparison = runAnswered('How are the stories of Nuh and Musa different?', [
            evidence('nuh-comparison', 'Nuh story evidence', 71, 1),
            evidence('musa-comparison', 'Musa story evidence', 20, 2),
        ]);
        const both = runAnswered('What lessons do we learn from both their stories?', [
            evidence('pair-lesson-a', 'The two stories contain grounded lessons', 71, 1),
            evidence('pair-lesson-b', 'The two accounts contain grounded lessons', 20, 2),
        ]);
        const normative = runAnswered('Is lending at interest prohibited and why?', [evidence('normative-a', 'Interest is prohibited with a stated reason', 2)]);
        const stateBeforeNormativeAbstention = state;
        const anotherNormative = buildChatQueryPlan({
            request: request('Is pride forbidden?', [{ role: 'user', content: priorUserQuestion! }]),
            validatedConversationState: state,
        });
        plans.push(anotherNormative);
        assert.equal(anotherNormative.contextSelected, false);
        assert.equal(state, stateBeforeNormativeAbstention);
        priorUserQuestion = 'Is pride forbidden?';

        const stateBeforeNonAnswer = state;
        const unsupportedQuestion = 'Which current digital asset is doing well now?';
        const unsupportedPlan = buildChatQueryPlan({
            request: request(unsupportedQuestion, [{ role: 'user', content: priorUserQuestion! }]),
            validatedConversationState: state,
        });
        plans.push(unsupportedPlan);
        priorUserQuestion = unsupportedQuestion;
        assert.equal(unsupportedPlan.contextSelected, false);
        assert.equal(state, stateBeforeNonAnswer);

        const worshipQuestion = 'Can I pray without purification?';
        const worshipPlan = buildChatQueryPlan({
            request: request(worshipQuestion, [{ role: 'user', content: priorUserQuestion }]),
            validatedConversationState: state,
        });
        plans.push(worshipPlan);

        assert.equal(plans.length, 11);
        assert.equal(persistedTurns, 8);
        assert.equal(maryam.taskType, 'entity_summary');
        assert.equal(kahf.taskType, 'entity_summary');
        assert.equal(nas.taskType, 'entity_summary');
        assert.equal(nuh.contextSelected, false);
        assert.equal(him.contextSelected, true);
        assert.equal(comparison.taskType, 'multi_entity_comparison');
        assert.deepEqual(comparison.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
        assert.equal(both.contextSelected, true);
        assert.deepEqual(both.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
        assert.equal(normative.contextSelected, false);
        assert.equal(anotherNormative.contextSelected, false);
        assert.equal(worshipPlan.contextSelected, false);
        assert.equal(classifyPolicy(worshipQuestion), 'allowed');
        assert.equal(classifyPolicy(unsupportedQuestion), 'allowed');
        assert.ok(state);
        assert.equal((state as ValidatedConversationState).entitySet.length, 0);
    });

    it('preserves task, entity, context, containment, state, and policy invariants across a noisy phone transcript', () => {
        const turns = [
            ['whats surah baqara basically abt', 'entity_summary', 2, 'answered'],
            ['what abt yusuf', 'point_question', 12, 'answered'],
            ['tell me main thing in maryam', 'entity_summary', 19, 'answered'],
            ['what can i learn frm kahf', 'entity_summary', 18, 'answered'],
            ['summarise al nas plz', 'entity_summary', 114, 'answered'],
            ['tell me abt nuh', 'point_question', 71, 'answered'],
            ['why they reject him', 'contextual_followup', 71, 'answered'],
            ['nuh vs musa whats different', 'multi_entity_comparison', 0, 'answered'],
            ['and both their stories teach what', 'multi_entity_comparison', 0, 'answered'],
            ['is riba harram and why', 'point_question', 2, 'answered'],
            ['arrogance haram?', 'point_question', 7, 'insufficient_evidence'],
            ['which crypto doing best rn', 'point_question', 0, 'insufficient_evidence'],
            ['can i pray without wuduu', 'point_question', 5, 'answered'],
        ] as const;
        const semanticTasks = new Map<string, ChatQueryPlan['taskType']>([
            ['whats surah baqara basically abt', 'entity_summary'],
            ['what abt yusuf', 'point_question'],
            ['tell me main thing in maryam', 'entity_summary'],
            ['tell me abt nuh', 'point_question'],
        ]);
        let state: ValidatedConversationState | null = null;
        let priorQuestion: string | null = null;
        let fallbackInvocations = 0;
        let stateDrift = 0;
        let containmentFailures = 0;
        let policyFailures = 0;

        for (const [question, expectedTask, evidenceSurah, resultType] of turns) {
            const history = priorQuestion ? [{ role: 'user' as const, content: priorQuestion }] : [];
            const currentRequest = request(question, history);
            let taskPlan = buildChatQueryPlan({ request: currentRequest, validatedConversationState: state });
            const fallbackInput = buildSemanticTaskFallbackInput({
                request: currentRequest,
                deterministicPlan: taskPlan,
                validatedConversationState: state,
            });
            if (fallbackInput) {
                fallbackInvocations += 1;
                const semanticTask = semanticTasks.get(question);
                assert.ok(semanticTask, question);
                taskPlan = applySemanticTaskClassification({
                    request: currentRequest,
                    deterministicPlan: taskPlan,
                    validatedConversationState: state,
                    taskType: semanticTask,
                });
            }
            assert.equal(taskPlan.taskType, expectedTask, question);
            assert.equal(taskPlan.requiresClarification, false, question);
            if (question === 'why they reject him') assert.equal(taskPlan.contextSelected, true);
            if (question === 'and both their stories teach what') {
                assert.equal(taskPlan.contextSelected, true);
                assert.deepEqual(taskPlan.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
            }
            if (question === 'nuh vs musa whats different') {
                assert.deepEqual(taskPlan.entitySet.map(item => item.id), ['subject:nuh', 'subject:musa']);
            }
            if (taskPlan.retrievalTask === 'entity_summary') {
                if (taskPlan.entity?.surahNumber !== evidenceSurah) containmentFailures += 1;
            }
            if (classifyPolicy(question) !== 'allowed') policyFailures += 1;

            const stateBefore: ValidatedConversationState | null = state;
            if (resultType === 'answered') {
                const items = taskPlan.retrievalTask === 'multi_entity_comparison'
                    ? [evidence(`${question}-nuh`, 'Nuh grounded evidence', 71), evidence(`${question}-musa`, 'Musa grounded evidence', 20, 2)]
                    : [evidence(question, `${question} grounded evidence`, evidenceSurah || 2)];
                const next = createValidatedConversationState({
                    request: currentRequest,
                    response: answered(items),
                    evidence: items,
                    taskPlan,
                    previousState: state,
                });
                assert.ok(next, question);
                state = next;
            } else if (resultType === 'insufficient_evidence') {
                assert.equal(state, stateBefore);
                const safeResponse = {
                    status: 'insufficient_evidence',
                    citations: [],
                } as const;
                assert.equal(safeResponse.status, 'insufficient_evidence');
                assert.deepEqual(safeResponse.citations, []);
                if (question === 'arrogance haram?') assert.equal(taskPlan.contextSelected, false);
            } else if (state !== stateBefore) {
                stateDrift += 1;
            }
            priorQuestion = question;
        }

        assert.equal(turns.length, 13);
        assert.equal(fallbackInvocations, 4);
        assert.equal(stateDrift, 0);
        assert.equal(containmentFailures, 0);
        assert.equal(policyFailures, 0);
    });
});
