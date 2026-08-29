const EXPECTED_DEVELOPMENT_BRANCH = 'feature/noor-ai-phase5';
const RELEASE_SHA_PATTERN = /^[0-9a-f]{40}$/iu;

function requestedReleaseSha(environment = process.env) {
    const raw = environment.NOOR_RELEASE_SHA;
    if (raw === undefined || raw.trim() === '') return null;
    if (!RELEASE_SHA_PATTERN.test(raw.trim())) {
        throw new Error('NOOR_RELEASE_SHA must be a 40-character hexadecimal commit SHA');
    }
    return raw.trim().toLowerCase();
}

function evaluateCarrierContract(input) {
    const releaseMode = input.requestedSha !== null;
    const checks = {
        cleanWorkingTree: input.dirty === false,
        exactReleaseSha: !releaseMode || input.head === input.requestedSha,
        releaseDetached: !releaseMode || input.branch === '',
        developmentBranch: releaseMode || input.branch === EXPECTED_DEVELOPMENT_BRANCH,
        requiredRuntime: input.ragExists === true,
        requiredScripts: input.scriptsExist === true,
        verificationCorpus: input.corpusPresent === true,
    };
    return {
        mode: releaseMode ? 'release' : 'development',
        ok: Object.values(checks).every(Boolean),
        checks,
        failedChecks: Object.entries(checks)
            .filter(([, passed]) => !passed)
            .map(([name]) => name),
    };
}

module.exports = {
    EXPECTED_DEVELOPMENT_BRANCH,
    evaluateCarrierContract,
    requestedReleaseSha,
};
