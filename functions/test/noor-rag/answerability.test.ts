import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    describeAnswerabilitySemantics,
    selectAnswerableEvidence,
} from '../../src/noor-rag/answerability';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import type { RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

const CONFIG: NoorRuntimeConfig = {
    enabled: true,
    publicEnabled: true,
    ownerUids: [],
    activeCorpusVersion: 'corpus-v1',
    promptVersion: 'answerability-test',
    generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
    pseudonymKeyVersion: 'test',
    sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
    maxChunksPerSource: 4,
    maxEvidenceCharacters: 50_000,
};

function evidence(id: string, text: string): RetrievedEvidence {
    const chunk: TafsirChunk = {
        chunkId: id,
        canonicalUnitId: `unit-${id}`,
        chunkIndex: 0,
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        language: 'en',
        surah: 2,
        verseStart: 1,
        verseEnd: 1,
        originalStart: 0,
        originalEnd: text.length,
        originalText: text,
        retrievalText: text,
        corpusVersion: 'corpus-v1',
        contentHash: `hash-${id}`,
        tokenCount: text.split(/\s+/u).length,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    return { kind: 'semantic', promptSourceId: 'S1', chunk, similarity: 0.9 };
}

describe('Noor point-question semantic answerability', () => {
    it('requires subject, requested relation, and current-state semantics instead of two token matches', () => {
        const query = 'Which cryptocurrency is doing well now?';
        const adjacent = evidence('adjacent', 'Which path will bring worldly wealth and trade?');

        const decision = describeAnswerabilitySemantics(query, [adjacent]);

        assert.deepEqual(decision.requiredSemanticSlots, [
            'subject',
            'relation_or_attribute',
            'temporal_or_current_requirement',
        ]);
        assert.deepEqual(decision.satisfiedSemanticSlots, []);
        assert.deepEqual(decision.unsatisfiedSemanticSlots, [
            'subject',
            'relation_or_attribute',
            'temporal_or_current_requirement',
        ]);
        assert.equal(decision.currentExternalStateRequired, true);
        assert.deepEqual(selectAnswerableEvidence(query, [adjacent], CONFIG), []);
    });

    it('rejects clean and noisy changing-state questions on adjacent static evidence', () => {
        const cases = [
            ['What was the latest football score?', 'A score can record what came before.'],
            ['Which cryptocurrency is doing well now?', 'Which path will lead to wealth.'],
            ['What is Bitcoin worth today?', 'A thing may be worth much in worldly value.'],
            ["Who won yesterday's World Cup match?", 'Some people won a contest and others lost.'],
            ['What is the weather in Cairo right now?', 'The weather can change between places.'],
            ['Which stock performed best today?', 'Trade performed well and brought profit.'],
            ['which crypto doing best rn', 'Which trade is best for worldly profit.'],
            ['bitcoin price today?', 'A price may reflect value in trade.'],
            ['latest football score?', 'The latest account records a score.'],
            ['weather cairo rn', 'Weather changes in Cairo.'],
            ['best stock today?', 'The best stock of provisions was stored.'],
            ['Who is the president now?', 'A president leads the people.'],
        ] as const;

        for (const [query, text] of cases) {
            const item = evidence(`current-${query.length}`, text);
            const decision = describeAnswerabilitySemantics(query, [item]);
            assert.equal(decision.currentExternalStateRequired, true, query);
            assert.ok(decision.requiredSemanticSlots.includes('temporal_or_current_requirement'), query);
            assert.ok(decision.unsatisfiedSemanticSlots.includes('temporal_or_current_requirement'), query);
            assert.deepEqual(selectAnswerableEvidence(query, [item], CONFIG), [], query);
        }
    });

    it('does not use interrogatives, function words, or weak lookalikes as substantive support', () => {
        const query = 'Which cryptocurrency is doing well now?';
        const incidental = evidence('function-words', 'Which choice will change the world now?');

        assert.deepEqual(selectAnswerableEvidence(query, [incidental], CONFIG), []);
        assert.equal(describeAnswerabilitySemantics(query, [incidental]).satisfiedSemanticSlots.length, 0);

        assert.deepEqual(
            selectAnswerableEvidence('Tell me about Jonah.', [evidence('jannah', 'Jannah is the promised garden.')], CONFIG),
            [],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Tell me about hell.', [evidence('halal', 'Halal means permitted.')], CONFIG),
            [],
        );
    });

    it('preserves conservative subject typo and transliteration tolerance', () => {
        assert.deepEqual(
            selectAnswerableEvidence(
                'Is caldorin harram?',
                [evidence('harram', 'Caldorin is prohibited because it causes harm.')],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['harram'],
        );
        assert.deepEqual(
            selectAnswerableEvidence(
                'Tell me about wuduu.',
                [evidence('wudu', 'Wudu is purification before prayer.')],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['wudu'],
        );
        assert.deepEqual(
            selectAnswerableEvidence(
                'Give a concise, source-cited explanation of the Quranic warning about riba.',
                [evidence('concise-riba', 'Riba is forbidden and carries a severe warning.')],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['concise-riba'],
        );
        assert.deepEqual(
            selectAnswerableEvidence(
                'Briefly explain riba.',
                [evidence('brief-riba', 'Riba is forbidden and prohibited.')],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['brief-riba'],
        );
    });

    it('preserves supported point relations and refuses unsupported relation upgrades', () => {
        const riba = evidence('riba', 'Riba is forbidden and prohibited.');
        const arrogance = evidence('arrogance', 'Arrogance is condemned and the proud are disgraced.');

        assert.deepEqual(selectAnswerableEvidence('Is riba haram?', [riba], CONFIG).map(item => item.chunk.chunkId), ['riba']);
        assert.deepEqual(
            selectAnswerableEvidence('What does the Quran say about arrogance?', [arrogance], CONFIG).map(item => item.chunk.chunkId),
            ['arrogance'],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Why is arrogance condemned?', [arrogance], CONFIG).map(item => item.chunk.chunkId),
            ['arrogance'],
        );
        assert.deepEqual(selectAnswerableEvidence('Is arrogance haram?', [arrogance], CONFIG), []);

        const pharaohOnly = evidence('pharaoh-only', 'Pharaoh ruled his people.');
        const pharaohOpposedOthers = evidence('pharaoh-opposed-others', 'Pharaoh opposed his people.');
        const opposition = evidence('opposition', 'Pharaoh opposed Musa and rejected his signs.');
        assert.deepEqual(selectAnswerableEvidence('Why did Pharaoh oppose Musa?', [pharaohOnly], CONFIG), []);
        assert.deepEqual(selectAnswerableEvidence('Why did Pharaoh oppose Musa?', [pharaohOpposedOthers], CONFIG), []);
        assert.deepEqual(
            selectAnswerableEvidence('Why did Pharaoh oppose Musa?', [opposition], CONFIG).map(item => item.chunk.chunkId),
            ['opposition'],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Is this prohibited?', [evidence('subjectless', 'Riba is prohibited.')], CONFIG),
            [],
        );
    });

    it('does not mistake ordinary historical sequencing for current external state', () => {
        const historical = evidence('historical', 'After Yusuf was imprisoned, he interpreted the dreams of two men.');
        const query = 'What happened after Yusuf was imprisoned?';

        assert.equal(describeAnswerabilitySemantics(query, [historical]).currentExternalStateRequired, false);
        assert.deepEqual(selectAnswerableEvidence(query, [historical], CONFIG).map(item => item.chunk.chunkId), ['historical']);

        const discourseMarker = 'Now, tell me about Nuh.';
        const nuh = evidence('nuh', 'Nuh called his people with patience.');
        assert.equal(describeAnswerabilitySemantics(discourseMarker, [nuh]).currentExternalStateRequired, false);
        assert.deepEqual(selectAnswerableEvidence(discourseMarker, [nuh], CONFIG).map(item => item.chunk.chunkId), ['nuh']);

        const framedQuestion = 'Now, what does the Quran say about riba?';
        const riba = evidence('historical-riba', 'Riba is forbidden in the Quran.');
        assert.equal(describeAnswerabilitySemantics(framedQuestion, [riba]).currentExternalStateRequired, false);
        assert.deepEqual(selectAnswerableEvidence(framedQuestion, [riba], CONFIG).map(item => item.chunk.chunkId), ['historical-riba']);

        const fixedHistory = 'Who was the most recent prophet mentioned in the Quran?';
        const fixedHistoryEvidence = evidence('fixed-history', 'The most recent prophet mentioned in the Quran was Idris.');
        assert.equal(describeAnswerabilitySemantics(fixedHistory, [fixedHistoryEvidence]).currentExternalStateRequired, false);
        assert.deepEqual(selectAnswerableEvidence(fixedHistory, [fixedHistoryEvidence], CONFIG), []);

        const storyHistory = 'Who was the latest ruler in Yusuf\'s story?';
        const storyEvidence = evidence('story-history', 'The latest ruler in Yusuf\'s story was the king who summoned him.');
        assert.equal(describeAnswerabilitySemantics(storyHistory, [storyEvidence]).currentExternalStateRequired, false);
        assert.deepEqual(selectAnswerableEvidence(storyHistory, [storyEvidence], CONFIG).map(item => item.chunk.chunkId), ['story-history']);
    });

    it('recognizes bounded relative-current phrases beyond one-word markers', () => {
        for (const query of [
            'What is the market value at present?',
            'Who won the match last night?',
            'Which result changed this week?',
        ]) {
            const item = evidence(`relative-${query.length}`, 'The market value and result changed after a match was won.');
            const decision = describeAnswerabilitySemantics(query, [item]);
            assert.equal(decision.currentExternalStateRequired, true, query);
            assert.ok(decision.unsatisfiedSemanticSlots.includes('temporal_or_current_requirement'), query);
            assert.deepEqual(selectAnswerableEvidence(query, [item], CONFIG), [], query);
        }

        const framedLive = 'What is Bitcoin worth today according to the Quran?';
        const adjacent = evidence('framed-live', 'The Quran describes things of worldly worth.');
        assert.equal(describeAnswerabilitySemantics(framedLive, [adjacent]).currentExternalStateRequired, true);
        assert.deepEqual(selectAnswerableEvidence(framedLive, [adjacent], CONFIG), []);

        const corpusDefinition = 'What does “today” mean in this verse?';
        const definitionEvidence = evidence('corpus-definition', 'The word today means the Day of Judgment in this verse.');
        assert.equal(describeAnswerabilitySemantics(corpusDefinition, [definitionEvidence]).currentExternalStateRequired, false);
        assert.deepEqual(
            selectAnswerableEvidence(corpusDefinition, [definitionEvidence], CONFIG).map(item => item.chunk.chunkId),
            ['corpus-definition'],
        );

        const unmarkedLocatedAttribute = 'What is the weather in Cairo?';
        const locatedAdjacent = evidence('located-live', 'The weather in Cairo changes.');
        assert.equal(describeAnswerabilitySemantics(unmarkedLocatedAttribute, [locatedAdjacent]).currentExternalStateRequired, true);
        assert.deepEqual(selectAnswerableEvidence(unmarkedLocatedAttribute, [locatedAdjacent], CONFIG), []);

        const pluralLocatedAttribute = 'What are the weather conditions in Cairo?';
        const pluralLocatedAdjacent = evidence('plural-located-live', 'The weather conditions in Cairo change.');
        assert.equal(describeAnswerabilitySemantics(pluralLocatedAttribute, [pluralLocatedAdjacent]).currentExternalStateRequired, true);
        assert.deepEqual(selectAnswerableEvidence(pluralLocatedAttribute, [pluralLocatedAdjacent], CONFIG), []);

        for (const [query, item] of [
            ['What is the lesson in Yusuf?', evidence('yusuf-lesson', 'The lesson in Yusuf teaches patience.')],
            ['What is the wisdom in fasting?', evidence('fasting-wisdom', 'The wisdom in fasting includes self-restraint.')],
        ] as const) {
            assert.equal(describeAnswerabilitySemantics(query, [item]).currentExternalStateRequired, false, query);
            assert.deepEqual(selectAnswerableEvidence(query, [item], CONFIG).map(value => value.chunk.chunkId), [item.chunk.chunkId], query);
        }
    });
});
