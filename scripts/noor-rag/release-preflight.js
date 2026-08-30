const fs = require('node:fs');
const path = require('node:path');

const STABLE_V3_SMOKE_INPUT = 'Tell me about Nuh.';
const REQUIRED_VERIFICATION_CORPUS_ARTIFACTS = ['units.json', 'chunks.json', 'lookups.json', 'manifest.json'];
const SHARED_SOURCE_IDENTITY = {
    schemaVersion: 1,
    normalizationVersion: 'html-entities-nfc-whitespace-v1',
    chunkingVersion: 'raw-paragraph-sentence-900-1400-overlap-80-v1',
    unitCount: 7867,
    lookupCount: 12408,
    sourceCounts: [
        { source: 'ibn_kathir_en_abridged', fileCount: 114, mappingCount: 6231, unitCount: 1895 },
        { source: 'al_sadi_ar', fileCount: 114, mappingCount: 6177, unitCount: 5972 },
    ],
};
const LOCAL_VERIFICATION_CORPUS = {
    corpusVersion: '2026-08-10-v1',
    unitCount: 7867,
    chunkCount: 9057,
    lookupCount: 12408,
    artifactSha256: {
        units: '29d54513663eed4bac1b289fa8485e5aed3d4a60e7dc2c5da8a63161335f79f3',
        chunks: 'b71d98e27bd69fcb8368788469705e817bd21c059d37d02daf8e7745dffcb866',
        lookups: 'f0f644c2e3fd574858df6a62a027fdd7b024759f083b0814f9050faaf78862ae',
    },
    aggregateSha256: 'f6efa40de7dfa052619232fdbc99b67e7d7a45f19bbacdee4c1947f639adbca5',
    sourceIdentity: SHARED_SOURCE_IDENTITY,
    tokenizerMode: 'local-deterministic',
    tokenizerModel: 'unicode-word-punctuation-v1',
    targetTokens: 900,
    hardMaxTokens: 1400,
    overlapTokens: 80,
    requiredArtifacts: REQUIRED_VERIFICATION_CORPUS_ARTIFACTS,
};
const PROMOTED_PRODUCTION_CORPUS = {
    corpusVersion: '2026-08-10-v1',
    unitCount: 7867,
    chunkCount: 9248,
    lookupCount: 12408,
    aggregateSha256: '5fadc4e1a14cb7d4087da39e2156a83f563ab7c9d2b3a6d6d21573395f1ab528',
    sourceIdentity: SHARED_SOURCE_IDENTITY,
    tokenizerMode: 'vertex-validated-deterministic',
    tokenizerModel: 'gemini-3.5-flash-lite',
    tokenValidation: {
        method: 'vertex-compute-tokens-final-chunks',
        location: 'global',
        validatedChunkCount: 9248,
    },
    embeddingModel: 'gemini-embedding-2',
    embeddingDimension: 768,
};
const PREDEPLOY_GATES = [
    'bootstrap',
    'corpus_preflight',
    'qa_auth',
    'qa_app_check',
    'qa_entitlement',
    'stable_smoke',
    'candidate_deploy',
    'candidate_baseline',
    'regression_pack',
    'clean_transcript',
    'messy_transcript',
    'reliability',
    'idempotency',
    'promotion',
    'cleanup',
];

function stableV3SmokeIsValid(smoke) {
    return smoke?.executed === true
        && smoke.input === STABLE_V3_SMOKE_INPUT
        && smoke.authValid === true
        && smoke.appCheckValid === true
        && smoke.ownerQaActive === true
        && smoke.resolvedTier === 'owner_qa'
        && smoke.dailyLimit === 100
        && smoke.status !== 'not_entitled'
        && smoke.responseContractValid === true
        && smoke.resultRecorded === true;
}

function sameJson(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}

function localVerificationCorpusIsValid(value) {
    return value?.ready === true
        && value.corpusVersion === LOCAL_VERIFICATION_CORPUS.corpusVersion
        && value.unitCount === LOCAL_VERIFICATION_CORPUS.unitCount
        && value.chunkCount === LOCAL_VERIFICATION_CORPUS.chunkCount
        && value.lookupCount === LOCAL_VERIFICATION_CORPUS.lookupCount
        && value.aggregateSha256 === LOCAL_VERIFICATION_CORPUS.aggregateSha256
        && sameJson(value.artifactSha256, LOCAL_VERIFICATION_CORPUS.artifactSha256)
        && Array.isArray(value.requiredArtifacts)
        && REQUIRED_VERIFICATION_CORPUS_ARTIFACTS.every(file => value.requiredArtifacts.includes(file))
        && sameJson(value.sourceIdentity, LOCAL_VERIFICATION_CORPUS.sourceIdentity)
        && value.tokenizerMode === LOCAL_VERIFICATION_CORPUS.tokenizerMode
        && value.tokenizerModel === LOCAL_VERIFICATION_CORPUS.tokenizerModel
        && value.targetTokens === LOCAL_VERIFICATION_CORPUS.targetTokens
        && value.hardMaxTokens === LOCAL_VERIFICATION_CORPUS.hardMaxTokens
        && value.overlapTokens === LOCAL_VERIFICATION_CORPUS.overlapTokens;
}

function promotedProductionCorpusIsValid(value) {
    return value?.ready === true
        && value.corpusVersion === PROMOTED_PRODUCTION_CORPUS.corpusVersion
        && value.unitCount === PROMOTED_PRODUCTION_CORPUS.unitCount
        && value.chunkCount === PROMOTED_PRODUCTION_CORPUS.chunkCount
        && value.lookupCount === PROMOTED_PRODUCTION_CORPUS.lookupCount
        && value.aggregateSha256 === PROMOTED_PRODUCTION_CORPUS.aggregateSha256
        && sameJson(value.sourceIdentity, PROMOTED_PRODUCTION_CORPUS.sourceIdentity)
        && value.tokenizerMode === PROMOTED_PRODUCTION_CORPUS.tokenizerMode
        && value.tokenizerModel === PROMOTED_PRODUCTION_CORPUS.tokenizerModel
        && sameJson(value.tokenValidation, PROMOTED_PRODUCTION_CORPUS.tokenValidation)
        && value.embeddingModel === PROMOTED_PRODUCTION_CORPUS.embeddingModel
        && value.embeddingDimension === PROMOTED_PRODUCTION_CORPUS.embeddingDimension;
}

function corpusRepresentationsAreCompatible(local, production) {
    return localVerificationCorpusIsValid(local)
        && promotedProductionCorpusIsValid(production)
        && local.corpusVersion === production.corpusVersion
        && local.unitCount === production.unitCount
        && local.lookupCount === production.lookupCount
        && sameJson(local.sourceIdentity, production.sourceIdentity);
}

function evaluatePredeployReadiness(input) {
    const localCorpus = input?.localVerificationCorpus;
    const productionCorpus = input?.promotedProductionCorpus;
    const checks = {
        localVerificationCorpusReady: localVerificationCorpusIsValid(localCorpus),
        promotedProductionCorpusReady: promotedProductionCorpusIsValid(productionCorpus),
        crossRepresentationCompatibility: corpusRepresentationsAreCompatible(localCorpus, productionCorpus),
        authQaIdentityCreated: input?.authQaIdentityCreated === true,
        appCheckCredentialValid: input?.appCheckValid === true,
        ownerQaReadback: input?.ownerQa?.existsActive === true,
        resolvedTierOwnerQa: input?.ownerQa?.resolvedTier === 'owner_qa',
        dailyLimit100: input?.ownerQa?.dailyLimit === 100,
        stableV3SmokeExecuted: input?.stableV3Smoke?.executed === true
            && input.stableV3Smoke.input === STABLE_V3_SMOKE_INPUT,
        stableV3SmokeValid: stableV3SmokeIsValid(input?.stableV3Smoke),
        stableV3SmokeResultRecorded: input?.stableV3Smoke?.resultRecorded === true,
        stableV3SmokeGateCompleted: input?.lastCompletedGate === 'stable_smoke',
    };
    const failedChecks = Object.entries(checks)
        .filter(([, passed]) => !passed)
        .map(([name]) => name);
    return {
        deployEligible: failedChecks.length === 0,
        unknownCountsAsPass: false,
        checks,
        failedChecks,
    };
}

function createPredeployGateTracker() {
    const gateStatus = {};
    let lastCompletedGate = null;
    return {
        complete(gate) {
            if (!PREDEPLOY_GATES.includes(gate)) throw new Error(`Unknown predeploy gate: ${gate}`);
            gateStatus[gate] = 'PASS';
            lastCompletedGate = gate;
        },
        fail(gate) {
            if (!PREDEPLOY_GATES.includes(gate)) throw new Error(`Unknown predeploy gate: ${gate}`);
            gateStatus[gate] = 'FAIL';
        },
        snapshot() {
            return { lastCompletedGate, gateStatus: { ...gateStatus } };
        },
    };
}

class PredeployReadinessError extends Error {
    constructor(failedChecks, lastCompletedGate) {
        super(`candidate_deployment_blocked: ${failedChecks.join(', ') || 'unknown_predeploy_state'}`);
        this.name = 'PredeployReadinessError';
        this.code = 'candidate_deployment_blocked';
        this.failedChecks = failedChecks;
        this.lastCompletedGate = lastCompletedGate;
    }
}

function assertCandidateDeploymentEligible(input, lastCompletedGate = null) {
    const result = evaluatePredeployReadiness(input);
    if (!result.deployEligible) throw new PredeployReadinessError(result.failedChecks, lastCompletedGate);
    return result;
}

function readReadinessReport(filePath) {
    if (!filePath) throw new PredeployReadinessError(['readiness_report_missing'], null);
    let value;
    try {
        value = JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8'));
    } catch (error) {
        const detail = error && typeof error.message === 'string' ? error.message.slice(0, 240) : 'invalid readiness report';
        throw new PredeployReadinessError([`readiness_report_invalid:${detail}`], null);
    }
    return value;
}

function main() {
    const report = readReadinessReport(process.env.NOOR_RELEASE_PREFLIGHT_REPORT);
    const result = assertCandidateDeploymentEligible(report, report.lastCompletedGate ?? null);
    process.stdout.write(`${JSON.stringify({ ...result, lastCompletedGate: report.lastCompletedGate ?? null })}\n`);
}

function startupFailureOutput(error) {
    const failedChecks = error instanceof PredeployReadinessError ? error.failedChecks : [];
    const message = error instanceof Error ? error.message.slice(0, 500) : 'candidate_deployment_blocked';
    return {
        status: 'FAILED',
        stage: 'predeploy_readiness',
        exitCode: 1,
        errorClass: error && typeof error.code === 'string' ? error.code : 'candidate_deployment_blocked',
        message,
        failedChecks,
        lastCompletedGate: error instanceof PredeployReadinessError ? error.lastCompletedGate : null,
    };
}

if (require.main === module) {
    try {
        main();
    } catch (error) {
        process.stderr.write(`${JSON.stringify(startupFailureOutput(error))}\n`);
        process.exitCode = 1;
    }
}

module.exports = {
    PREDEPLOY_GATES,
    LOCAL_VERIFICATION_CORPUS,
    PROMOTED_PRODUCTION_CORPUS,
    REQUIRED_VERIFICATION_CORPUS_ARTIFACTS,
    STABLE_V3_SMOKE_INPUT,
    PredeployReadinessError,
    assertCandidateDeploymentEligible,
    createPredeployGateTracker,
    evaluatePredeployReadiness,
    readReadinessReport,
    startupFailureOutput,
    stableV3SmokeIsValid,
};
