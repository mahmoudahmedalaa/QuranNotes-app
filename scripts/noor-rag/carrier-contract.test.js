const assert = require('node:assert/strict');
const test = require('node:test');

const {
    EXPECTED_DEVELOPMENT_BRANCH,
    evaluateCarrierContract,
    requestedReleaseSha,
} = require('./carrier-contract');

const RELEASE_SHA = 'a63d804577868cd99fab3df7e31d965fff888d8c';

function validCarrier(overrides = {}) {
    return {
        branch: '',
        head: RELEASE_SHA,
        dirty: false,
        ragExists: true,
        scriptsExist: true,
        corpusPresent: true,
        requestedSha: RELEASE_SHA,
        ...overrides,
    };
}

test('attached wrong branch fails in normal development mode', () => {
    const result = evaluateCarrierContract(validCarrier({
        branch: 'codex/noor-release-preflight-hardening',
        requestedSha: null,
    }));
    assert.equal(result.mode, 'development');
    assert.equal(result.ok, false);
    assert.ok(result.failedChecks.includes('developmentBranch'));
});

test('detached HEAD at the wrong SHA fails in release mode', () => {
    const result = evaluateCarrierContract(validCarrier({ head: 'b'.repeat(40) }));
    assert.equal(result.mode, 'release');
    assert.equal(result.ok, false);
    assert.ok(result.failedChecks.includes('exactReleaseSha'));
});

test('detached HEAD at the requested SHA passes in release mode', () => {
    const result = evaluateCarrierContract(validCarrier());
    assert.equal(result.mode, 'release');
    assert.equal(result.ok, true);
    assert.deepEqual(result.failedChecks, []);
});

test('dirty detached exact-SHA carrier fails', () => {
    const result = evaluateCarrierContract(validCarrier({ dirty: true }));
    assert.equal(result.ok, false);
    assert.ok(result.failedChecks.includes('cleanWorkingTree'));
});

test('exact SHA with missing verification corpus fails', () => {
    const result = evaluateCarrierContract(validCarrier({ corpusPresent: false }));
    assert.equal(result.ok, false);
    assert.ok(result.failedChecks.includes('verificationCorpus'));
});

test('exact SHA with missing required scripts or runtime fails', () => {
    const missingScripts = evaluateCarrierContract(validCarrier({ scriptsExist: false }));
    const missingRuntime = evaluateCarrierContract(validCarrier({ ragExists: false }));
    assert.equal(missingScripts.ok, false);
    assert.ok(missingScripts.failedChecks.includes('requiredScripts'));
    assert.equal(missingRuntime.ok, false);
    assert.ok(missingRuntime.failedChecks.includes('requiredRuntime'));
});

test('canonical development carrier keeps the expected branch rule', () => {
    const result = evaluateCarrierContract({
        branch: EXPECTED_DEVELOPMENT_BRANCH,
        head: 'c'.repeat(40),
        dirty: false,
        ragExists: true,
        scriptsExist: true,
        corpusPresent: true,
        requestedSha: null,
    });
    assert.equal(result.mode, 'development');
    assert.equal(result.ok, true);
});

test('release mode requires an explicit valid SHA', () => {
    assert.equal(requestedReleaseSha({}), null);
    assert.equal(requestedReleaseSha({ NOOR_RELEASE_SHA: RELEASE_SHA }), RELEASE_SHA);
    assert.throws(
        () => requestedReleaseSha({ NOOR_RELEASE_SHA: 'not-a-sha' }),
        /NOOR_RELEASE_SHA must be a 40-character hexadecimal commit SHA/,
    );
});
