const fs = require('node:fs');
const path = require('node:path');

const STABLE_V3_SMOKE_INPUT = 'Tell me about Nuh.';
const REQUIRED_VERIFICATION_CORPUS_ARTIFACTS = ['units.json', 'chunks.json', 'lookups.json', 'manifest.json'];
const PROMOTED_VERIFICATION_CORPUS = {
    corpusVersion: '2026-08-10-v1',
    aggregateSha256: 'f6efa40de7dfa052619232fdbc99b67e7d7a45f19bbacdee4c1947f639adbca5',
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

function evaluatePredeployReadiness(input) {
    const corpus = input?.verificationCorpus;
    const checks = {
        verificationCorpusReady: corpus?.ready === true
            && corpus.corpusVersion === PROMOTED_VERIFICATION_CORPUS.corpusVersion
            && corpus.aggregateSha256 === PROMOTED_VERIFICATION_CORPUS.aggregateSha256
            && Array.isArray(corpus.requiredArtifacts)
            && REQUIRED_VERIFICATION_CORPUS_ARTIFACTS.every(file => corpus.requiredArtifacts.includes(file)),
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
    PROMOTED_VERIFICATION_CORPUS,
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
