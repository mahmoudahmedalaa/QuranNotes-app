import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    applySemanticTaskClassification,
    buildChatQueryPlan,
    buildSemanticTaskFallbackInput,
    type ValidatedConversationState,
} from '../../src/noor-rag/queryRewrite';
import { resolveQuranSurahEntityCandidate } from '../../src/noor-rag/quranEntities';
import { resolveQuranSurahEntityCandidateMatch } from '../../src/noor-rag/quranEntities';
import type { NoorChatRequest } from '../../src/noor-rag/types';

const REQUEST_ID = '92000000-0000-4000-8000-000000000001';

function request(question: string, history: NoorChatRequest['history'] = []): NoorChatRequest {
    return { mode: 'chat', requestId: REQUEST_ID, question, history };
}

function fingerprint(question: string): string {
    return createHash('sha256').update(question.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, ' ').trim()).digest('hex');
}

function stateFor(question: string, entities: ValidatedConversationState['entitySet']): ValidatedConversationState {
    const sourceQuestionFingerprint = fingerprint(question);
    return {
        subjectTokens: ['stories'],
        evidenceIds: ['chunk-1', 'chunk-2'],
        evidenceCount: 2,
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        sourceQuestionFingerprint,
        activeTask: entities.length > 1 ? 'multi_entity_comparison' : 'point_question',
        primaryEntity: entities[0] ?? null,
        entitySet: entities,
        comparisonFrame: entities.length > 1,
        referentialRoles: entities.map(entity => entity.id),
        semanticSubject: ['stories'],
        previousTurnFingerprint: sourceQuestionFingerprint,
        validatedEvidenceRefs: ['chunk-1', 'chunk-2'],
    };
}

function semanticPlan(question: string, taskType: Parameters<typeof applySemanticTaskClassification>[0]['taskType']) {
    const currentRequest = request(question);
    const deterministicPlan = buildChatQueryPlan({ request: currentRequest });
    return applySemanticTaskClassification({
        request: currentRequest,
        validatedConversationState: null,
        deterministicPlan,
        taskType,
    });
}

describe('Noor natural-language planner', () => {
    it('preserves clean and messy task/entity boundaries as metamorphic invariants', () => {
        const cleanSummary = buildChatQueryPlan({ request: request('What is Surah Maryam about?') });
        const messySummaryRequest = request('what surah maryam abt');
        const messySummary = applySemanticTaskClassification({
            request: messySummaryRequest,
            deterministicPlan: buildChatQueryPlan({ request: messySummaryRequest }),
            taskType: 'entity_summary',
        });
        assert.equal(cleanSummary.taskType, messySummary.taskType);
        assert.equal(cleanSummary.entity?.surahNumber, messySummary.entity?.surahNumber);

        const prior = 'Tell me about Prophet Nuh.';
        const contextState = stateFor(prior, [{ id: 'subject:nuh', label: 'nuh', kind: 'subject' }]);
        const cleanContext = buildChatQueryPlan({
            request: request('Why did they reject him?', [{ role: 'user', content: prior }]),
            validatedConversationState: contextState,
        });
        const messyContext = buildChatQueryPlan({
            request: request('why they reject him', [{ role: 'user', content: prior }]),
            validatedConversationState: contextState,
        });
        assert.equal(cleanContext.taskType, messyContext.taskType);
        assert.equal(cleanContext.contextSelected, messyContext.contextSelected);

        const cleanMulti = buildChatQueryPlan({ request: request('How are Nuh and Musa different?') });
        const messyMulti = buildChatQueryPlan({ request: request('nuh vs musa whats different') });
        assert.equal(cleanMulti.taskType, messyMulti.taskType);
        assert.deepEqual(cleanMulti.entitySet.map(entity => entity.id), messyMulti.entitySet.map(entity => entity.id));
    });

    it('keeps clean high-confidence planning deterministic and flags only ambiguous entity operations', () => {
        for (const question of [
            'What is Surah Maryam about?',
            'Could you tell me about Surah Yusuf?',
            'Tell me the main themes of Al-Kahf',
            'tell me main thing in kahf',
            'what is the overall msg of surah yusuf',
            'What does 2:275 say?',
            'is riba harram',
            'why is arrogance bad',
        ]) {
            const currentRequest = request(question);
            const plan = buildChatQueryPlan({ request: currentRequest });
            assert.equal(buildSemanticTaskFallbackInput({ request: currentRequest, deterministicPlan: plan }), null, question);
        }

        for (const question of ['what surah maryam abt']) {
            const currentRequest = request(question);
            const deterministicPlan = buildChatQueryPlan({ request: currentRequest });
            assert.equal(deterministicPlan.taskType, 'point_question');
            assert.ok(buildSemanticTaskFallbackInput({ request: currentRequest, deterministicPlan }), question);
        }
    });

    it('routes the messy synthesis matrix through semantic task interpretation without phrase production rules', () => {
        const cases = [
            ['what surah maryam abt', 19],
            ['tell me main thing in kahf', 18],
            ['whats baqarah basically about', 2],
            ['explain surah yusuf simply', 12],
            ['give me gist of surah mulk', 67],
            ['what can i learn frm surah kahf', 18],
            ['summarise al nas plz', 114],
            ['what maryam mainly saying', 19],
            ['explain baqara like im new', 2],
            ['what is the overall msg of surah yusuf', 12],
            ['What is Surah Yusuf basically about?', 12],
        ] as const;

        for (const [question, surahNumber] of cases) {
            const plan = semanticPlan(question, 'entity_summary');
            assert.equal(plan.taskType, 'entity_summary', question);
            assert.equal(plan.retrievalTask, 'entity_summary', question);
            assert.equal(plan.entity?.surahNumber, surahNumber, question);
            assert.equal(plan.requiresClarification, false, question);
        }
    });

    it('keeps messy point questions on the point fast path', () => {
        for (const question of [
            'who is maryam',
            'why did nuh ppl reject him',
            'what did maryam tell them',
            'why did yusuf forgive them',
            'Do the main themes of Surah Yusuf include patience?',
            'Do the main lessons of Surah Yusuf include patience?',
            'Please tell me, is Surah Yusuf mainly about patience?',
            'Could you tell me whether Surah Yusuf is mainly about patience?',
            'Could you tell me, is Surah Yusuf mainly about patience?',
            'what happened to yusuf in prison',
            'Tell me about the prison in Surah Yusuf',
            'What about the prison in Surah Yusuf?',
            'What is the prison story in Surah Yusuf about?',
            'What is Surah Yusuf prison about?',
            'what does 2:275 say',
            'is riba harram',
            'why is arrogance bad',
            'how long did nuh preach',
            'what happened after musa crossed the sea',
        ]) {
            const currentRequest = request(question);
            const plan = buildChatQueryPlan({ request: currentRequest });
            assert.equal(plan.taskType, 'point_question', question);
            assert.equal(plan.requiresClarification, false, question);
            assert.deepEqual(plan.variants, [{ kind: 'original', query: question }], question);
            assert.equal(buildSemanticTaskFallbackInput({ request: currentRequest, deterministicPlan: plan }), null, question);
        }
        for (const question of [
            'Is Surah Yusuf mainly about patience?',
            'why Nuh people reject him?',
        ]) {
            const currentRequest = request(question);
            const plan = buildChatQueryPlan({ request: currentRequest });
            assert.equal(plan.taskType, 'point_question', question);
            assert.equal(plan.requiresClarification, false, question);
            assert.equal(buildSemanticTaskFallbackInput({ request: currentRequest, deterministicPlan: plan }), null, question);
        }
    });

    it('uses a validated discourse frame for ambiguous fragments and rejects ungrounded contextual output', () => {
        const prior = 'nuh vs musa whats different';
        const entities = [
            { id: 'subject:nuh', label: 'nuh', kind: 'subject' as const },
            { id: 'subject:musa', label: 'musa', kind: 'subject' as const },
        ];
        const state = stateFor(prior, entities);
        for (const question of ['why tho', 'what happened nxt', 'what abt musa']) {
            const currentRequest = request(question, [{ role: 'user', content: prior }]);
            const deterministicPlan = buildChatQueryPlan({ request: currentRequest, validatedConversationState: state });
            const fallback = buildSemanticTaskFallbackInput({
                request: currentRequest, deterministicPlan, validatedConversationState: state,
            });
            if (question === 'what abt musa') assert.ok(fallback, question);
            else assert.equal(fallback, null, question);
            const plan = applySemanticTaskClassification({
                request: currentRequest,
                deterministicPlan,
                validatedConversationState: state,
                taskType: 'contextual_followup',
            });
            assert.equal(plan.taskType, 'contextual_followup', question);
            assert.equal(plan.contextSelected, true, question);
            assert.equal(plan.requiresClarification, false, question);
            if (question === 'what abt musa') {
                assert.deepEqual(plan.entitySet.map(entity => entity.id), ['subject:musa']);
                assert.equal(plan.retrievalTask, 'point_question');
            }
        }

        const noStateRequest = request('why tho');
        const noStatePlan = buildChatQueryPlan({ request: noStateRequest });
        const rejected = applySemanticTaskClassification({
            request: noStateRequest,
            deterministicPlan: noStatePlan,
            validatedConversationState: null,
            taskType: 'contextual_followup',
        });
        assert.equal(rejected.requiresClarification, true);
        assert.equal(rejected.contextSelected, false);

        const stalePrior = 'Tell me about Prophet Nuh.';
        const staleState = stateFor(stalePrior, [{ id: 'subject:nuh', label: 'nuh', kind: 'subject' }]);
        const switchedRequest = request('what abt yusuf', [{ role: 'user', content: stalePrior }]);
        const switchedDeterministic = buildChatQueryPlan({
            request: switchedRequest,
            validatedConversationState: staleState,
        });
        const switched = applySemanticTaskClassification({
            request: switchedRequest,
            deterministicPlan: switchedDeterministic,
            validatedConversationState: staleState,
            taskType: 'contextual_followup',
        });
        assert.equal(switched.taskType, 'point_question');
        assert.equal(switched.contextSelected, false);
        assert.deepEqual(switched.variants, [{ kind: 'original', query: 'what abt yusuf' }]);
    });

    it('preserves two entities for informal comparisons and plural references', () => {
        for (const question of [
            'nuh vs musa whats different',
            'compare nuh and musa',
            'how r yusuf and nuh different',
            'maryam and yusuf whats diff',
            'what about Maryam and Yusuf whats diff',
            'compare Maryam and Yusuf whats diff',
            'compare Maryam and Yusuf in the Quran',
        ]) {
            const plan = buildChatQueryPlan({ request: request(question) });
            assert.equal(plan.taskType, 'multi_entity_comparison', question);
            assert.equal(plan.entitySet.length, 2, question);
            if (question === 'what about Maryam and Yusuf whats diff'
                || question === 'compare Maryam and Yusuf whats diff'
                || question === 'compare Maryam and Yusuf in the Quran') {
                assert.deepEqual(plan.entitySet.map(entity => entity.id), ['subject:maryam', 'subject:yusuf']);
            }
        }

        const prior = 'nuh vs musa whats different';
        const first = buildChatQueryPlan({ request: request(prior) });
        const state = stateFor(prior, first.entitySet);
        for (const question of ['what can we learn frm both', 'both their stories teach what', 'and both of them?']) {
            const plan = buildChatQueryPlan({
                request: request(question, [{ role: 'user', content: prior }]),
                validatedConversationState: state,
            });
            assert.equal(plan.taskType, 'multi_entity_comparison', question);
            assert.deepEqual(plan.entitySet.map(entity => entity.id), ['subject:nuh', 'subject:musa'], question);
            assert.equal(plan.contextSelected, true, question);
        }
    });

    it('uses conservative canonical candidate matching for common transliteration and minor spelling variation', () => {
        const cases = [
            ['mariam', 19], ['maryam', 19], ['al kahf', 18], ['surah kahaf', 18],
            ['baqara', 2], ['baqarah', 2], ['yousuf', 12], ['yusuf', 12],
            ['surah nooh', 71], ['nuh', 71],
            ['surah maryyam', 19], ['surah yusuuf', 12], ['surah kahff', 18],
            ['surah nuhh', 71], ['surah baqarrah', 2],
            ['surah al kahff', 18],
        ] as const;
        for (const [value, surahNumber] of cases) {
            assert.equal(resolveQuranSurahEntityCandidate(value)?.surahNumber, surahNumber, value);
        }
        for (const unrelated of [
            'mouse', 'noise', 'market', 'banana', 'kafka', 'room', 'milk', 'faith', 'fate', 'said',
            'kahaf', 'nooh', 'shame', 'salad', 'insane',
        ]) {
            assert.equal(resolveQuranSurahEntityCandidate(unrelated), null, unrelated);
        }
    });

    it('does not promote an unmarked person candidate to a Surah when semantic output overclassifies it', () => {
        for (const question of [
            'tell me about Yusuf',
            'tell me abt nuh',
            "What's the main thing about being sad?",
        ]) {
            const currentRequest = request(question);
            const deterministicPlan = buildChatQueryPlan({ request: currentRequest });
            const applied = applySemanticTaskClassification({
                request: currentRequest,
                deterministicPlan,
                taskType: 'entity_summary',
            });
            assert.equal(applied.taskType, 'point_question', question);
            assert.equal(applied.entity, null, question);
            assert.equal(applied.explicitEntity, false, question);
        }
        const unrelatedRequest = request('What lessons can I learn about being fair?');
        const unrelated = applySemanticTaskClassification({
            request: unrelatedRequest,
            deterministicPlan: buildChatQueryPlan({ request: unrelatedRequest }),
            taskType: 'entity_summary',
        });
        assert.equal(unrelated.entity, null);
        assert.equal(unrelated.explicitEntity, false);
        assert.equal(unrelated.requiresClarification, true);
    });

    it('narrows an informal follow-up to one canonical Surah in a two-Surah frame', () => {
        const prior = 'Compare Surah Maryam and Surah Yusuf.';
        const initial = buildChatQueryPlan({ request: request(prior) });
        const state = stateFor(prior, initial.entitySet);
        const currentRequest = request('what abt yusuf', [{ role: 'user', content: prior }]);
        const deterministicPlan = buildChatQueryPlan({ request: currentRequest, validatedConversationState: state });
        const applied = applySemanticTaskClassification({
            request: currentRequest,
            deterministicPlan,
            validatedConversationState: state,
            taskType: 'contextual_followup',
        });
        assert.deepEqual(applied.entitySet.map(entity => entity.id), ['surah:12']);
        assert.equal(applied.retrievalTask, 'point_question');
        assert.equal(applied.contextSelected, true);
    });

    it('keeps explicit typo-Surah containment when semantic task output remains point', () => {
        for (const [question, surahNumber] of [
            ['what surah maryyam abt', 19],
            ['tell me main thing in surah kahff', 18],
            ['what surah nuhh abt', 71],
            ['what surah baqarrah abt', 2],
        ] as const) {
            const currentRequest = request(question);
            const applied = applySemanticTaskClassification({
                request: currentRequest,
                deterministicPlan: buildChatQueryPlan({ request: currentRequest }),
                taskType: 'point_question',
            });
            assert.equal(applied.taskType, 'point_question', question);
            assert.equal(applied.entity?.surahNumber, surahNumber, question);
            assert.equal(applied.explicitEntity, true, question);
            assert.equal(applied.requiresClarification, false, question);
        }
        const unrelatedMarkerRequest = request('tell me about Yusuf and this surah');
        const unrelatedMarker = resolveQuranSurahEntityCandidateMatch(unrelatedMarkerRequest.question);
        assert.equal(unrelatedMarker?.explicitSurahMarker, false);
        const applied = applySemanticTaskClassification({
            request: unrelatedMarkerRequest,
            deterministicPlan: buildChatQueryPlan({ request: unrelatedMarkerRequest }),
            taskType: 'point_question',
        });
        assert.equal(applied.entity, null);
        assert.equal(applied.explicitEntity, false);
    });
});
