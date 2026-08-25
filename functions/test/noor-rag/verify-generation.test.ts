import * as assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { classifyGenerationOutcome } from '../../scripts/noor-rag/verify-generation';
import type { GenerationDiagnostics } from '../../src/noor-rag/generation';

function diagnostics(errorClass: GenerationDiagnostics['errorClass']): GenerationDiagnostics {
    return {
        errorClass,
        attempts: 1,
        generationAttemptCount: 1,
        generationFailurePhase: 'none',
        structuralValidationResult: 'not_run',
        citationValidationResult: 'not_run',
        citationValidationFailureSubtype: null,
        qualityJudgeInvoked: false,
        generationRetryInvoked: false,
        correctionInvoked: false,
        finalGenerationErrorClass: errorClass,
    };
}

describe('Noor real-provider generation verifier', () => {
    it('keeps provider, structure, citation, and quality failures in separate bounded metrics', () => {
        assert.equal(classifyGenerationOutcome({ status: 'answered' }, diagnostics(null)), 'answered');
        assert.equal(classifyGenerationOutcome({ status: 'temporarily_unavailable' }, diagnostics('provider_timeout')), 'provider_failure');
        assert.equal(classifyGenerationOutcome({ status: 'temporarily_unavailable' }, diagnostics('malformed_json')), 'structured_failure');
        assert.equal(classifyGenerationOutcome({ status: 'temporarily_unavailable' }, diagnostics('citation_validation_failure')), 'citation_failure');
        assert.equal(classifyGenerationOutcome({ status: 'temporarily_unavailable' }, diagnostics('answer_quality_failure')), 'quality_failure');
        assert.equal(classifyGenerationOutcome({ status: 'insufficient_evidence' }, diagnostics(null)), 'other_failure');
    });
});
