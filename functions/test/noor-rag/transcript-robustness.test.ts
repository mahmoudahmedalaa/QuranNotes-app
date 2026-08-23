import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyPolicy } from '../../src/noor-rag/policy';
import {
    buildChatQueryPlan,
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
        const anotherNormative = runAnswered('Is pride forbidden?', [evidence('normative-b', 'Pride is forbidden in this passage', 7)]);

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
        assert.equal(persistedTurns, 9);
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
});
