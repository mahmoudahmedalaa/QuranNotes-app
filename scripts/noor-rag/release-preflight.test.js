const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
    STABLE_V3_SMOKE_INPUT,
    PROMOTED_VERIFICATION_CORPUS,
    REQUIRED_VERIFICATION_CORPUS_ARTIFACTS,
    assertCandidateDeploymentEligible,
    createPredeployGateTracker,
    evaluatePredeployReadiness,
} = require('./release-preflight');

function readyInput(overrides = {}) {
    return {
        verificationCorpus: {
            ready: true,
            corpusVersion: PROMOTED_VERIFICATION_CORPUS.corpusVersion,
            aggregateSha256: PROMOTED_VERIFICATION_CORPUS.aggregateSha256,
            requiredArtifacts: [...REQUIRED_VERIFICATION_CORPUS_ARTIFACTS],
        },
        authQaIdentityCreated: true,
        appCheckValid: true,
        ownerQa: { existsActive: true, resolvedTier: 'owner_qa', dailyLimit: 100 },
        stableV3Smoke: {
            executed: true,
            input: STABLE_V3_SMOKE_INPUT,
            authValid: true,
            appCheckValid: true,
            ownerQaActive: true,
            resolvedTier: 'owner_qa',
            dailyLimit: 100,
            status: 'answered',
            responseContractValid: true,
            resultRecorded: true,
        },
        lastCompletedGate: 'stable_smoke',
        ...overrides,
    };
}

test('candidate eligibility requires every explicit predeploy condition', () => {
    assert.equal(evaluatePredeployReadiness(readyInput()).deployEligible, true);
    assert.doesNotThrow(() => assertCandidateDeploymentEligible(readyInput(), 'stable_smoke'));
});

test('missing or unknown readiness blocks deployment for every required failure mode', () => {
    const cases = [
        ['CorpusMissing', readyInput({ verificationCorpus: { ready: false } })],
        ['OwnerQaUnknown', readyInput({ ownerQa: { existsActive: false, resolvedTier: null, dailyLimit: null } })],
        ['DailyLimitUnknown', readyInput({ ownerQa: { existsActive: true, resolvedTier: 'owner_qa', dailyLimit: null } })],
        ['SmokeNotRun', readyInput({ stableV3Smoke: { ...readyInput().stableV3Smoke, executed: false } })],
        ['SmokeFailed', readyInput({ stableV3Smoke: { ...readyInput().stableV3Smoke, status: 'not_entitled' } })],
    ];
    for (const [label, input] of cases) {
        const result = evaluatePredeployReadiness(input);
        assert.equal(result.deployEligible, false, label);
        assert.throws(() => assertCandidateDeploymentEligible(input, 'qa_entitlement'), /candidate_deployment_blocked/);
    }
});

test('the all-pass report is the only state eligible for candidate deployment', () => {
    const result = evaluatePredeployReadiness(readyInput());
    assert.equal(result.failedChecks.length, 0);
    assert.equal(result.unknownCountsAsPass, false);
});

test('the gate tracker preserves the last completed gate after a failure', () => {
    const tracker = createPredeployGateTracker();
    tracker.complete('bootstrap');
    tracker.fail('corpus_preflight');
    assert.equal(tracker.snapshot().lastCompletedGate, 'bootstrap');
    assert.equal(tracker.snapshot().gateStatus.corpus_preflight, 'FAIL');
});

test('Firebase predeploy wiring includes package separation and readiness gates', () => {
    const firebase = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../firebase.json'), 'utf8'));
    const predeploy = firebase.functions[0].predeploy;
    assert.ok(predeploy.some(command => command.includes('verify-deployment-package.js')));
    assert.ok(predeploy.some(command => command.includes('release-preflight.js')));
});

test('missing readiness evidence fails as structured predeploy output', () => {
    const environment = { ...process.env };
    delete environment.NOOR_RELEASE_PREFLIGHT_REPORT;
    const result = spawnSync(process.execPath, [path.join(__dirname, 'release-preflight.js')], {
        encoding: 'utf8',
        env: environment,
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stderr.trim());
    assert.equal(report.errorClass, 'candidate_deployment_blocked');
    assert.deepEqual(report.failedChecks, ['readiness_report_missing']);
    assert.equal(report.lastCompletedGate, null);
});

test('the CLI report is required and is read from a controlled JSON file', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-release-preflight-'));
    const report = path.join(directory, 'readiness.json');
    fs.writeFileSync(report, JSON.stringify(readyInput({ lastCompletedGate: 'stable_smoke' })));
    const result = require('./release-preflight').readReadinessReport(report);
    assert.equal(result.stableV3Smoke.input, STABLE_V3_SMOKE_INPUT);
});
