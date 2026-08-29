const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const {
    evaluateCarrierContract,
    requestedReleaseSha,
} = require('./carrier-contract');

const repositoryRoot = resolve(__dirname, '../..');
const functionsRoot = resolve(repositoryRoot, 'functions');
const corpusVersion = '2026-08-10-v1';
const requiredVerificationCorpusArtifacts = ['units.json', 'chunks.json', 'lookups.json', 'manifest.json'];
const casesPath = resolve(functionsRoot, 'evals/noor-golden-cases.json');

const summary = [];

function commandOutput(command, args, cwd = repositoryRoot) {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function lastJson(output) {
    for (let start = output.lastIndexOf('{'); start >= 0; start = output.lastIndexOf('{', start - 1)) {
        try {
            return JSON.parse(output.slice(start).trim());
        } catch {
            // Try the enclosing object after skipping nested JSON objects.
        }
    }
    throw new Error('JSON result was not printed');
}

function runStep(label, command, args, cwd = repositoryRoot) {
    try {
        const output = commandOutput(command, args, cwd);
        summary.push({ label, ok: true });
        return output;
    } catch (error) {
        const stdout = error.stdout ? String(error.stdout).trim().split('\n').slice(-8).join('\n') : '';
        const stderr = error.stderr ? String(error.stderr).trim().split('\n').slice(-8).join('\n') : '';
        summary.push({ label, ok: false });
        process.stderr.write(`FAIL ${label}\n${[stdout, stderr].filter(Boolean).join('\n')}\n`);
        return null;
    }
}

function verifyCarrier() {
    const branch = commandOutput('git', ['branch', '--show-current']).trim();
    const head = commandOutput('git', ['rev-parse', 'HEAD']).trim();
    const status = commandOutput('git', ['status', '--porcelain', '--untracked-files=all']).trim();
    const ragExists = existsSync(resolve(functionsRoot, 'src/noor-rag'));
    const scriptsExist = existsSync(resolve(functionsRoot, 'scripts/noor-rag'));
    const lockedSource = readFileSync(resolve(functionsRoot, 'scripts/noor-rag/verify-index.ts'), 'utf8');
    const lockedVersionPresent = lockedSource.includes(`LOCKED_CORPUS_VERSION = '${corpusVersion}'`);
    const corpusDirectory = resolve(functionsRoot, '.generated', 'noor-corpus', corpusVersion);
    const corpusArtifactsPresent = requiredVerificationCorpusArtifacts.every(file => existsSync(join(corpusDirectory, file)));
    const releaseSha = requestedReleaseSha();
    const result = evaluateCarrierContract({
        branch,
        head,
        dirty: status !== '',
        ragExists,
        scriptsExist,
        corpusPresent: lockedVersionPresent && corpusArtifactsPresent,
        requestedSha: releaseSha,
    });
    if (!result.ok) {
        throw new Error(`carrier mismatch mode=${result.mode} releaseSha=${releaseSha ?? '(none)'} branch=${branch} head=${head} dirty=${status !== ''} rag=${ragExists} scripts=${scriptsExist} corpus=${lockedVersionPresent && corpusArtifactsPresent} failed=${result.failedChecks.join(',')}`);
    }
    process.stdout.write(`CARRIER mode=${result.mode} branch=${branch || '(detached)'} head=${head} status=clean rag=present scripts=present corpus=${corpusVersion}\n`);
}

function main() {
    try {
        verifyCarrier();
        const build = runStep('corpus build', 'npm', ['run', 'noor:corpus:build', '--', `--version=${corpusVersion}`, '--counter=local'], functionsRoot);
        const buildResult = build ? lastJson(build) : null;
        const validate = runStep('corpus manifest validation', 'npm', ['run', 'noor:corpus:validate', '--', `--version=${corpusVersion}`, '--counter=local'], functionsRoot);
        const validateResult = validate ? lastJson(validate) : null;
        if (buildResult && validateResult) {
            process.stdout.write(`CORPUS valid=${validateResult.valid} version=${corpusVersion} units=${validateResult.unitCount} chunks=${validateResult.chunkCount} lookups=${validateResult.lookupCount} sha256=${validateResult.aggregateSha256}\n`);
        }

        const golden = runStep('golden local retrieval', 'npm', ['run', 'noor:eval:golden', '--', `--version=${corpusVersion}`], functionsRoot);
        if (golden) {
            const result = lastJson(golden);
            process.stdout.write(`GOLDEN exact=${result.executedExactCases} passRate=${result.casePassRate} evidenceHitRate=${result.expectedEvidenceHitRate} semanticDeferred=${result.deferredSemanticCases} failed=${result.failedCaseIds.length}\n`);
            if (result.cases.length < 12 || result.cases.length > 20) {
                summary.push({ label: 'golden case count', ok: false });
                process.stderr.write(`FAIL golden case count expected 12-20 actual=${result.cases.length}\n`);
            }
        }

        runStep('functions tests', 'npm', ['test'], functionsRoot);
        runStep('functions build', 'npm', ['run', 'build'], functionsRoot);
        runStep('functions scripts build', 'npm', ['run', 'build:scripts'], functionsRoot);
        runStep('contract check', 'npm', ['run', 'contract:check'], functionsRoot);
        runStep('root typecheck', 'npm', ['run', 'typecheck']);
        runStep('root relevant tests', 'npm', ['test', '--', '--runInBand']);
    } catch (error) {
        summary.push({ label: 'carrier', ok: false });
        process.stderr.write(`FAIL carrier\n${error instanceof Error ? error.message : 'carrier verification failed'}\n`);
    }

    const failed = summary.filter(item => !item.ok);
    process.stdout.write(`STRUCTURAL/DETERMINISTIC VERIFICATION passed=${summary.length - failed.length} failed=${failed.length}\n`);
    process.stdout.write('REAL SEMANTIC RETRIEVAL: NOT RUN — use npm run noor:verify:retrieval with supported credentials\n');
    process.stdout.write('AUTHENTICATED END-TO-END LIVE: NOT RUN — use npm run noor:verify:live\n');
    if (failed.length > 0) process.exitCode = 1;
}

main();
