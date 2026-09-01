import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
    describeAnswerabilitySemantics,
    selectAnswerableEvidence,
    type EvidenceQualificationContract,
} from '../../src/noor-rag/answerability';
import type { ComparisonCitationContract } from '../../src/noor-rag/citations';
import type { NoorRuntimeConfig } from '../../src/noor-rag/config';
import {
    generateGroundedAnswer,
    getGenerationDiagnostics,
    type GenerationProvider,
    type VertexGenerationRequest,
} from '../../src/noor-rag/generation';
import { buildChatQueryPlan } from '../../src/noor-rag/queryRewrite';
import type { NoorRequest, RetrievedEvidence, TafsirChunk } from '../../src/noor-rag/types';

const REQUEST_ID = '99999999-9999-4999-8999-999999999999';
const CONFIG: NoorRuntimeConfig = {
    enabled: true,
    publicEnabled: true,
    ownerUids: [],
    activeCorpusVersion: 'contract-corpus',
    promptVersion: 'contract-prompt',
    generationModel: 'gemini-3.5-flash-lite',
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
    pseudonymKeyVersion: 'test',
    sourceThresholds: { ibn_kathir_en_abridged: 0.6, al_sadi_ar: 0.7 },
    maxChunksPerSource: 4,
    maxEvidenceCharacters: 20_000,
};

const QUALITY_PASS = JSON.stringify({
    grounded: true,
    answersQuestion: true,
    preservesMaterialQualifications: true,
    materiallyMisleading: false,
    clear: true,
    citationConsistent: true,
});

function evidence(id: string, text: string, surah = 10): RetrievedEvidence {
    const chunk: TafsirChunk = {
        chunkId: `chunk-${id}`,
        canonicalUnitId: `unit-${id}`,
        chunkIndex: 0,
        source: 'ibn_kathir_en_abridged',
        sourceTitle: 'Tafsir Ibn Kathir',
        language: 'en',
        surah,
        verseStart: 1,
        verseEnd: 2,
        originalStart: 0,
        originalEnd: text.length,
        originalText: text,
        retrievalText: text,
        corpusVersion: 'contract-corpus',
        contentHash: `hash-${id}`,
        tokenCount: text.split(/\s+/u).length,
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
    };
    return { kind: 'semantic', promptSourceId: id, chunk, similarity: 0.95 };
}

class SequenceProvider implements GenerationProvider {
    readonly requests: VertexGenerationRequest[] = [];

    constructor(private readonly results: readonly string[]) {}

    async generate(request: VertexGenerationRequest): Promise<string> {
        this.requests.push(request);
        const result = this.results[this.requests.length - 1];
        if (result === undefined) throw new Error('fixture exhausted');
        return result;
    }
}

function request(question: string): NoorRequest {
    return { mode: 'chat', requestId: REQUEST_ID, question, history: [] };
}

function qualificationContract(input: Readonly<{
    relation: string;
    slots?: readonly string[];
    entityProvenance?: readonly Readonly<{ entityId: string; evidenceIds: readonly string[] }>[];
    task?: string;
}>): EvidenceQualificationContract {
    const slots = input.slots ?? ['subject', 'relation_or_attribute'];
    return {
        task: input.task ?? 'point_question',
        relation: input.relation,
        requiredSemanticSlots: slots,
        satisfiedSemanticSlots: slots,
        unsatisfiedSemanticSlots: [],
        currentExternalStateRequired: false,
        selectedEvidenceIds: ['S1', 'S2'].filter(id => (
            input.entityProvenance ?? [{ entityId: 'subject:caldorin', evidenceIds: ['S1'] }]
        ).some(entity => entity.evidenceIds.includes(id))),
        entityProvenance: input.entityProvenance ?? [{ entityId: 'subject:caldorin', evidenceIds: ['S1'] }],
    } as EvidenceQualificationContract;
}

function insufficient(reason: string): string {
    return JSON.stringify({ status: 'insufficient_evidence', abstentionReason: reason, answer: '', citationIds: [] });
}

function answered(text: string, citationIds: readonly string[]): string {
    return JSON.stringify({ status: 'answered', abstentionReason: 'not_applicable', answer: text, citationIds });
}

async function qualifyThenGenerate(question: string, candidates: readonly RetrievedEvidence[]): Promise<Readonly<{
    selected: readonly RetrievedEvidence[];
    providerCalls: number;
    status: string;
}>> {
    const selected = selectAnswerableEvidence(question, candidates, CONFIG);
    const provider = new SequenceProvider([]);
    const response = await generateGroundedAnswer({
        request: request(question),
        evidence: selected,
        maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
        provider,
    });
    return { selected, providerCalls: provider.requests.length, status: response.status };
}

describe('Noor deterministic evidence-generation contract', () => {
    it('A: fails closed when the sole quality correction claims a proven subject is missing', async () => {
        const selected = [evidence('S1', 'Caldorin has a documented alternative in the supplied account.')];
        const provider = new SequenceProvider([
            answered('Caldorin has a documented alternative. [S1]', ['S1']),
            JSON.stringify({
                grounded: true,
                answersQuestion: false,
                preservesMaterialQualifications: true,
                materiallyMisleading: false,
                clear: true,
                citationConsistent: true,
            }),
            insufficient('missing_subject_support'),
        ]);

        const response = await generateGroundedAnswer({
            request: request('What alternative is documented for Caldorin?'),
            evidence: selected,
            maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
            provider,
            answerabilityContract: qualificationContract({ relation: 'alternative' }),
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.equal(provider.requests.length, 3);
        assert.equal(getGenerationDiagnostics(response)?.finalGenerationErrorClass, 'generation_contract_disagreement');
    });

    it('B: corrects one initial missing-relation contradiction with unchanged semantics and evidence IDs', async () => {
        const provider = new SequenceProvider([
            insufficient('missing_relation_support'),
            answered('Caldorin has a documented alternative. [S1]', ['S1']),
            QUALITY_PASS,
        ]);
        const contract = qualificationContract({ relation: 'alternative' });
        const response = await generateGroundedAnswer({
            request: request('What alternative is documented for Caldorin?'),
            evidence: [evidence('S1', 'Caldorin has a documented alternative in the supplied account.')],
            maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
            provider,
            answerabilityContract: contract,
        });

        assert.equal(response.status, 'answered');
        assert.equal(provider.requests.length, 3);
        assert.match(provider.requests[0]?.contents ?? '', /<evidenceQualificationContract/i);
        assert.match(provider.requests[0]?.contents ?? '', /relation="alternative"/i);
        assert.match(provider.requests[0]?.contents ?? '', /entityId="subject:caldorin"[^>]*evidenceIds="S1"/i);
        assert.match(provider.requests[1]?.contents ?? '', /do not claim.*established.*slot.*missing/i);
        for (const index of [0, 1]) {
            assert.match(provider.requests[index]?.contents ?? '', /<question>What alternative is documented for Caldorin\?<\/question>/);
            assert.deepEqual(
                [...(provider.requests[index]?.contents ?? '').matchAll(/<promptSourceId>(S\d+)<\/promptSourceId>/g)].map(match => match[1]),
                ['S1'],
            );
        }
    });

    it('C: stops before generation when deterministic qualification lacks the requested relation', async () => {
        const result = await qualifyThenGenerate(
            'What alternative is documented for Caldorin?',
            [evidence('S1', 'Caldorin is mentioned in the supplied account.')],
        );

        assert.deepEqual(result.selected, []);
        assert.equal(result.providerCalls, 0);
        assert.equal(result.status, 'insufficient_evidence');
    });

    it('D: preserves a genuine independent evidence conflict as canonical insufficient evidence', async () => {
        const provider = new SequenceProvider([insufficient('evidence_conflict')]);
        const response = await generateGroundedAnswer({
            request: request('What alternative is documented for Caldorin?'),
            evidence: [evidence('S1', 'Caldorin has a documented alternative in the supplied account.')],
            maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
            provider,
            answerabilityContract: qualificationContract({ relation: 'alternative' }),
        });

        assert.equal(response.status, 'insufficient_evidence');
        assert.equal(response.answer, 'I could not find enough reliable tafsir evidence to answer that safely.');
        assert.equal(provider.requests.length, 1);
        assert.equal(getGenerationDiagnostics(response)?.correctionInvoked, false);
    });

    it('E: permits one correction only and fails closed when the contradiction repeats', async () => {
        const provider = new SequenceProvider([
            insufficient('missing_relation_support'),
            insufficient('missing_relation_support'),
        ]);
        const response = await generateGroundedAnswer({
            request: request('What alternative is documented for Caldorin?'),
            evidence: [evidence('S1', 'Caldorin has a documented alternative in the supplied account.')],
            maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
            provider,
            answerabilityContract: qualificationContract({ relation: 'alternative' }),
        });

        assert.equal(response.status, 'temporarily_unavailable');
        assert.equal(provider.requests.length, 2);
        assert.equal(getGenerationDiagnostics(response)?.correctionInvoked, true);
        assert.equal(getGenerationDiagnostics(response)?.finalGenerationErrorClass, 'generation_contract_disagreement');
    });

    it('F: carries proven multi-entity branch provenance through one contradiction correction', async () => {
        const comparisonRequest = request('Compare Caldorin and Velunari by their documented response.');
        const taskPlan = buildChatQueryPlan({ request: comparisonRequest as Extract<NoorRequest, { mode: 'chat' }> });
        const comparisonCitationContract: ComparisonCitationContract = {
            taskType: 'multi_entity_comparison',
            entities: [
                { id: 'subject:caldorin', label: 'Caldorin', evidenceIds: ['S1'] },
                { id: 'subject:velunari', label: 'Velunari', evidenceIds: ['S2'] },
            ],
            allowedEvidenceIds: ['S1', 'S2'],
        };
        const contract = qualificationContract({
            task: 'multi_entity_comparison',
            relation: 'response',
            slots: ['subject', 'relation_or_attribute', 'comparison'],
            entityProvenance: comparisonCitationContract.entities.map(entity => ({
                entityId: entity.id,
                evidenceIds: entity.evidenceIds,
            })),
        });
        const provider = new SequenceProvider([
            insufficient('missing_subject_support'),
            answered(
                'Caldorin received a documented response. [S1]\n\nVelunari received a distinct documented response. [S2]\n\nCaldorin and Velunari therefore have separately evidenced responses. [S1, S2]',
                ['S1', 'S2'],
            ),
            QUALITY_PASS,
        ]);
        const response = await generateGroundedAnswer({
            request: comparisonRequest,
            evidence: [
                evidence('S1', 'Caldorin received a documented response.'),
                evidence('S2', 'Velunari received a distinct documented response.', 11),
            ],
            maxEvidenceCharacters: CONFIG.maxEvidenceCharacters,
            provider,
            taskPlan,
            comparisonCitationContract,
            answerabilityContract: contract,
        });

        assert.equal(response.status, 'answered');
        assert.equal(provider.requests.length, 3);
        for (const index of [0, 1, 2]) {
            assert.match(provider.requests[index]?.contents ?? '', /entityId="subject:caldorin"[^>]*evidenceIds="S1"/i);
            assert.match(provider.requests[index]?.contents ?? '', /entityId="subject:velunari"[^>]*evidenceIds="S2"/i);
        }
    });

    it('G: stops before generation when current-world state is required but static evidence cannot prove it', async () => {
        const question = 'Which observatory is performing best today?';
        const candidates = [evidence('S1', 'The observatory performed well in the recorded account.')];
        const decision = describeAnswerabilitySemantics(question, candidates);
        const result = await qualifyThenGenerate(question, candidates);

        assert.ok(decision.unsatisfiedSemanticSlots.includes('temporal_or_current_requirement'));
        assert.deepEqual(result.selected, []);
        assert.equal(result.providerCalls, 0);
    });

    it('H: stops before generation when evidence lacks the requested normative strength', async () => {
        const question = 'Is Velunari prohibited?';
        const candidates = [evidence('S1', 'Velunari is criticized in the supplied account.')];
        const decision = describeAnswerabilitySemantics(question, candidates);
        const result = await qualifyThenGenerate(question, candidates);

        assert.ok((decision.unsatisfiedSemanticSlots as readonly string[]).includes('normative_strength'));
        assert.deepEqual(result.selected, []);
        assert.equal(result.providerCalls, 0);
    });
});
