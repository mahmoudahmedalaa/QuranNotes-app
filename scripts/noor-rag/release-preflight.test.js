const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const {
    STABLE_V3_SMOKE_INPUT,
    REQUIRED_VERIFICATION_CORPUS_ARTIFACTS,
    assertCandidateDeploymentEligible,
    createPredeployGateTracker,
    evaluatePredeployReadiness,
} = require('./release-preflight');

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
};

const PROMOTED_PRODUCTION_CORPUS = {
    corpusVersion: '2026-08-10-v1',
    unitCount: 7867,
    chunkCount: 9248,
    lookupCount: 12408,
    aggregateSha256: '5fadc4e1a14cb7d4087da39e2156a83f563ab7c9d2b3a6d6d21573395f1ab528',
};

const LOCAL_SOURCE_IDENTITY = {
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

function localVerificationCorpus(overrides = {}) {
    return {
        ready: true,
        corpusVersion: LOCAL_VERIFICATION_CORPUS.corpusVersion,
        unitCount: LOCAL_VERIFICATION_CORPUS.unitCount,
        chunkCount: LOCAL_VERIFICATION_CORPUS.chunkCount,
        lookupCount: LOCAL_VERIFICATION_CORPUS.lookupCount,
        aggregateSha256: LOCAL_VERIFICATION_CORPUS.aggregateSha256,
        artifactSha256: LOCAL_VERIFICATION_CORPUS.artifactSha256,
        requiredArtifacts: [...REQUIRED_VERIFICATION_CORPUS_ARTIFACTS],
        sourceIdentity: LOCAL_SOURCE_IDENTITY,
        tokenizerMode: 'local-deterministic',
        tokenizerModel: 'unicode-word-punctuation-v1',
        targetTokens: 900,
        hardMaxTokens: 1400,
        overlapTokens: 80,
        ...overrides,
    };
}

function promotedProductionCorpus(overrides = {}) {
    return {
        ready: true,
        corpusVersion: PROMOTED_PRODUCTION_CORPUS.corpusVersion,
        unitCount: PROMOTED_PRODUCTION_CORPUS.unitCount,
        chunkCount: PROMOTED_PRODUCTION_CORPUS.chunkCount,
        lookupCount: PROMOTED_PRODUCTION_CORPUS.lookupCount,
        aggregateSha256: PROMOTED_PRODUCTION_CORPUS.aggregateSha256,
        sourceIdentity: LOCAL_SOURCE_IDENTITY,
        tokenizerMode: 'vertex-validated-deterministic',
        tokenizerModel: 'gemini-3.5-flash-lite',
        tokenValidation: {
            method: 'vertex-compute-tokens-final-chunks',
            location: 'global',
            validatedChunkCount: 9248,
        },
        embeddingModel: 'gemini-embedding-2',
        embeddingDimension: 768,
        ...overrides,
    };
}

function readyInput(overrides = {}) {
    return {
        localVerificationCorpus: localVerificationCorpus(),
        promotedProductionCorpus: promotedProductionCorpus(),
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
        ['CorpusMissing', readyInput({ localVerificationCorpus: { ready: false } })],
        ['ProductionCorpusMissing', readyInput({ promotedProductionCorpus: { ready: false } })],
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

test('known local and promoted representations are compatible without exact chunk identity', () => {
    const result = evaluatePredeployReadiness(readyInput());
    assert.equal(result.deployEligible, true);
    assert.equal(result.checks.localVerificationCorpusReady, true);
    assert.equal(result.checks.promotedProductionCorpusReady, true);
    assert.equal(result.checks.crossRepresentationCompatibility, true);
});

test('wrong local verification identity blocks the release corpus gate', () => {
    const result = evaluatePredeployReadiness(readyInput({
        localVerificationCorpus: localVerificationCorpus({ aggregateSha256: '0'.repeat(64) }),
    }));
    assert.equal(result.deployEligible, false);
    assert.ok(result.failedChecks.includes('localVerificationCorpusReady'));
});

test('wrong promoted production hash or count blocks the release corpus gate', () => {
    for (const promotedProductionCorpusValue of [
        promotedProductionCorpus({ aggregateSha256: '0'.repeat(64) }),
        promotedProductionCorpus({ chunkCount: 9057 }),
    ]) {
        const result = evaluatePredeployReadiness(readyInput({ promotedProductionCorpus: promotedProductionCorpusValue }));
        assert.equal(result.deployEligible, false);
        assert.ok(result.failedChecks.includes('promotedProductionCorpusReady'));
    }
});

test('unexpected source identity blocks cross-representation compatibility', () => {
    const result = evaluatePredeployReadiness(readyInput({
        promotedProductionCorpus: promotedProductionCorpus({
            sourceIdentity: { ...LOCAL_SOURCE_IDENTITY, chunkingVersion: 'unexpected-chunking' },
        }),
    }));
    assert.equal(result.deployEligible, false);
    assert.ok(result.failedChecks.includes('crossRepresentationCompatibility'));
});

test('missing local artifact evidence and unknown production evidence both block', () => {
    const missingLocal = evaluatePredeployReadiness(readyInput({
        localVerificationCorpus: localVerificationCorpus({ requiredArtifacts: ['units.json'] }),
    }));
    const unknownProduction = evaluatePredeployReadiness(readyInput({
        promotedProductionCorpus: { ready: false },
    }));
    assert.equal(missingLocal.deployEligible, false);
    assert.equal(unknownProduction.deployEligible, false);
    assert.ok(missingLocal.failedChecks.includes('localVerificationCorpusReady'));
    assert.ok(unknownProduction.failedChecks.includes('promotedProductionCorpusReady'));
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
