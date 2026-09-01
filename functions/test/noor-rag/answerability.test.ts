import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    describeAnswerabilitySemantics,
    qualifyEntitySummaryAnswerableEvidence,
    selectAnswerableEvidence,
    selectComparisonAnswerableEvidence,
    selectContextualAnswerableEvidence,
} from '../../src/noor-rag/answerability';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import type { QuranSurahEntity } from '../../src/noor-rag/quranEntities';
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
    it('treats broad summary learning as synthesis while retaining explicit constrained requirements', () => {
        const entity: QuranSurahEntity = {
            entityType: 'surah', surahNumber: 2, canonicalName: 'Synthetic', verseCount: 1,
        };
        const selected = [evidence('summary-learning', 'The selected passages provide broad material across the entity.')];
        const capacity = { canonicalUnits: 1, sections: 1, span: 0 };

        const broadLearning = qualifyEntitySummaryAnswerableEvidence(
            'What can we learn from the whole entity?',
            entity,
            selected,
            capacity,
        );
        assert.deepEqual(broadLearning.evidence, selected);
        assert.equal(broadLearning.decision.relation, 'teaching');
        assert.deepEqual(broadLearning.decision.unsatisfiedSemanticSlots, []);

        for (const question of [
            'What color can we learn from the whole entity?',
            'What medical procedure can we learn from the whole entity?',
            'Summarize what is forbidden in the whole entity.',
            'Summarize the narrative of the whole entity.',
            'What are the current themes of the whole entity?',
        ]) {
            assert.deepEqual(
                qualifyEntitySummaryAnswerableEvidence(question, entity, selected, capacity).evidence,
                [],
                question,
            );
        }
    });

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

    it('treats generic shorthand descriptions and omitted prerequisites as semantic equivalents', () => {
        for (const query of ['tell me abt caldorin', 'what abt caldorin']) {
            assert.deepEqual(
                selectAnswerableEvidence(
                    query,
                    [evidence('shorthand-description', 'Caldorin is a bounded historical practice.')],
                    CONFIG,
                ).map(item => item.chunk.chunkId),
                ['shorthand-description'],
                query,
            );
        }

        const prerequisite = evidence(
            'generic-prerequisite',
            'Zenthos is required before operating Floran safely.',
        );
        for (const query of [
            'Can I operate Floran without Zenthos?',
            'Can I operate Floran wthout Zenthos?',
            'Can I operate Floran withuot Zenthos?',
            'Can I operate Floran wihout Zenthos?',
        ]) {
            assert.deepEqual(
                selectAnswerableEvidence(query, [prerequisite], CONFIG)
                    .map(item => item.chunk.chunkId),
                ['generic-prerequisite'],
                query,
            );
            assert.deepEqual(describeAnswerabilitySemantics(query, [prerequisite]).unsatisfiedSemanticSlots, [], query);
        }

        assert.deepEqual(
            selectAnswerableEvidence(
                'Can I speak without a permit?',
                [evidence('generic-lexical-family', 'A permit is required before a speaker may operate.')],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['generic-lexical-family'],
        );
        assert.deepEqual(
            selectAnswerableEvidence(
                'Can I operate Floran without Zenthos?',
                [evidence('generic-adjacent', 'Zenthos and Floran are mentioned together.')],
                CONFIG,
            ),
            [],
        );

        const unchangedEvidence = evidence('query-only-normalization', 'Zenthos wthout Floran is only an unrelated phrase.');
        const originalEvidenceText = unchangedEvidence.chunk.retrievalText;
        assert.deepEqual(selectAnswerableEvidence('Can I operate Floran wthout Zenthos?', [unchangedEvidence], CONFIG), []);
        assert.equal(unchangedEvidence.chunk.retrievalText, originalEvidenceText);

        const purification = evidence(
            'purification-prerequisite',
            'Wudu is commanded for prayer and is an obligation in the case of impurity.',
        );
        for (const query of ['Can I pray without wudu?', 'can i pray without wuduu']) {
            assert.deepEqual(
                selectAnswerableEvidence(query, [purification], CONFIG).map(item => item.chunk.chunkId),
                ['purification-prerequisite'],
                query,
            );
        }
    });

    it('preserves supported point relations and refuses unsupported relation upgrades', () => {
        const riba = evidence('riba', 'Riba is forbidden and prohibited.');
        const arrogance = evidence('arrogance', 'Arrogance is condemned because the proud reject the truth and are disgraced.');

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
        const opposition = evidence('opposition', 'Pharaoh opposed Musa because he rejected his signs.');
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

    it('binds subject and requested relation within the same semantic segment', () => {
        const directProhibition = evidence('direct-prohibition', 'Caldorin is prohibited because it causes harm.');
        const condemnationOnly = evidence('condemnation-only', 'Caldorin is condemned because it causes harm.');
        const adjacentPrerequisite = evidence(
            'adjacent-prerequisite',
            'Zenthos is required for prayer. Operating Floran is described elsewhere.',
        );
        const directPrerequisite = evidence(
            'direct-prerequisite',
            'Zenthos is required before operating Floran safely.',
        );
        const causal = evidence('causal', 'Caldorin changed because the council rejected it.');
        const conditionalCause = evidence(
            'conditional-cause',
            'If Caldorin is used to mislead people, then Caldorin is condemned.',
        );
        const linkedCause = evidence(
            'linked-cause',
            'Just as Caldorin breached the agreement, the council condemned Caldorin.',
        );
        const derivedSubjectCause = evidence(
            'derived-subject-cause',
            'Just as the council acted defiantly, it was disgraced.',
        );
        const descriptiveOnly = evidence('descriptive-only', 'Caldorin changed during the council meeting.');

        assert.deepEqual(
            selectAnswerableEvidence('Is Caldorin prohibited?', [directProhibition], CONFIG).map(item => item.chunk.chunkId),
            ['direct-prohibition'],
        );
        assert.deepEqual(selectAnswerableEvidence('Is Caldorin prohibited?', [condemnationOnly], CONFIG), []);
        assert.deepEqual(selectAnswerableEvidence('Can I operate Floran without Zenthos?', [adjacentPrerequisite], CONFIG), []);
        assert.deepEqual(
            selectAnswerableEvidence('Can I operate Floran without Zenthos?', [directPrerequisite], CONFIG)
                .map(item => item.chunk.chunkId),
            ['direct-prerequisite'],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Why did Caldorin change?', [causal], CONFIG).map(item => item.chunk.chunkId),
            ['causal'],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Why is Caldorin condemned?', [conditionalCause], CONFIG)
                .map(item => item.chunk.chunkId),
            ['conditional-cause'],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Why is Caldorin condemned?', [linkedCause], CONFIG)
                .map(item => item.chunk.chunkId),
            ['linked-cause'],
        );
        assert.deepEqual(
            selectAnswerableEvidence('Why is defiance condemned?', [derivedSubjectCause], CONFIG)
                .map(item => item.chunk.chunkId),
            ['derived-subject-cause'],
        );
        assert.deepEqual(selectAnswerableEvidence('Why did Caldorin change?', [descriptiveOnly], CONFIG), []);
    });

    it('normalizes concatenated source headings without borrowing relation support across segments', () => {
        const sourceHeading = evidence(
            'source-heading',
            'Virtues of ZenthoraThe recorded account explains its importance.',
        );
        const unrelated = evidence(
            'unrelated-heading',
            'Virtues are recorded here. Zenthora is described in another sentence.',
        );

        assert.deepEqual(
            selectAnswerableEvidence(
                'What is its significance? Regarding Zenthora.',
                [sourceHeading],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['source-heading'],
        );
        assert.deepEqual(
            selectAnswerableEvidence(
                'What is its significance? Regarding Zenthora.',
                [unrelated],
                CONFIG,
            ),
            [],
        );
    });

    it('qualifies comparison evidence by entity branch and requested dimension', () => {
        const caldorinAccount = evidence('caldorin-account', 'Caldorin faced exile and later returned to the city.');
        const caldorinLesson = evidence('caldorin-lesson', 'The account of Caldorin teaches a lesson about patience.');

        assert.deepEqual(
            selectComparisonAnswerableEvidence(
                'Caldorin',
                'What differs between the stories of Caldorin and Velunari?',
                [caldorinAccount],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['caldorin-account'],
        );
        assert.deepEqual(
            selectComparisonAnswerableEvidence(
                'Caldorin',
                'Compare the lessons from Caldorin and Velunari.',
                [caldorinAccount],
                CONFIG,
            ),
            [],
        );
        assert.deepEqual(
            selectComparisonAnswerableEvidence(
                'Caldorin',
                'Compare the lessons from Caldorin and Velunari.',
                [caldorinLesson],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['caldorin-lesson'],
        );
    });

    it('qualifies contextual evidence from validated subject scope and locally bound relation semantics', () => {
        const supportedRejection = evidence(
            'supported-contextual-rejection',
            'Caldorin faced a council that said, "We do not believe you and will not follow you when only outsiders support you."',
        );
        const wrongRelation = evidence(
            'wrong-contextual-relation',
            'This account concerns Caldorin. The council condemned the proposal because it caused harm.',
        );
        const missingCause = evidence(
            'missing-contextual-cause',
            'This account concerns Caldorin. The council did not believe the proposal during the meeting.',
        );
        const wrongExplicitSubject = evidence(
            'wrong-explicit-subject',
            'This account concerns Caldorin. The council did not believe Velunari when only outsiders supported it.',
        );

        assert.deepEqual(
            selectContextualAnswerableEvidence(
                ['caldorin'],
                'Why did they reject him?',
                [supportedRejection, wrongRelation, missingCause],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['supported-contextual-rejection'],
        );
        assert.deepEqual(
            selectContextualAnswerableEvidence(
                ['caldorin'],
                'Why did they reject Floran?',
                [wrongExplicitSubject],
                CONFIG,
            ),
            [],
        );
    });

    it('does not combine a resolved contextual subject with relation support from another semantic segment', () => {
        const crossSegmentCause = evidence(
            'cross-segment-cause',
            'Caldorin is named here. Velunari rejected Floran because Floran opposed the council.',
        );
        const sameSegmentCause = evidence(
            'same-segment-cause',
            'Caldorin was rejected by the council because Caldorin opposed its proposal.',
        );
        const crossSegmentCondemnation = evidence(
            'cross-segment-condemnation',
            'Caldorin is described in this paragraph. Velunari was condemned because Velunari broke the agreement.',
        );
        const wrongResolvedSubject = evidence(
            'wrong-resolved-subject',
            'Velunari was rejected by the council because Velunari opposed its proposal.',
        );
        const multiParagraph = evidence(
            'multi-paragraph',
            'Caldorin is the subject of the first account.\n\nThe later account says Velunari was rejected because Velunari opposed the council.',
        );

        assert.deepEqual(
            selectContextualAnswerableEvidence(
                ['caldorin'],
                'Why did they reject him?',
                [crossSegmentCause, crossSegmentCondemnation, wrongResolvedSubject, multiParagraph],
                CONFIG,
            ),
            [],
        );
        assert.deepEqual(
            selectContextualAnswerableEvidence(
                ['caldorin'],
                'Why did they reject him?',
                [sameSegmentCause],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['same-segment-cause'],
        );
    });

    it('uses validated contextual subject for unambiguous progression without weakening no-context behavior', () => {
        const caldorinProgression = evidence(
            'caldorin-progression',
            'The account concerns Caldorin. Caldorin continued to warn the council after their refusal.',
        );
        const velunariProgression = evidence(
            'velunari-progression',
            'The account concerns Velunari. Velunari returned to the city after the council meeting.',
        );

        assert.deepEqual(
            selectContextualAnswerableEvidence(
                ['caldorin'],
                'And then?',
                [caldorinProgression, velunariProgression],
                CONFIG,
            ).map(item => item.chunk.chunkId),
            ['caldorin-progression'],
        );
        assert.deepEqual(
            selectContextualAnswerableEvidence([], 'And then?', [caldorinProgression], CONFIG),
            [],
        );
    });

    it('rejects contextual and comparison current-state requests against static recorded evidence', () => {
        const contextual = evidence(
            'contextual-current-state',
            'The observatory performed best in the recorded account.',
        );
        assert.deepEqual(
            selectContextualAnswerableEvidence(
                ['observatory'],
                'How is it doing now?',
                [contextual],
                CONFIG,
            ),
            [],
        );

        const comparison = evidence(
            'comparison-current-state',
            'Caldorin performed best today in the recorded account.',
        );
        assert.deepEqual(
            selectComparisonAnswerableEvidence(
                'Caldorin',
                'Which is performing best today, Caldorin or Velunari?',
                [comparison],
                CONFIG,
            ),
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
