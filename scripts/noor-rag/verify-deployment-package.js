const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const { minimatch } = require('minimatch');
const { join, relative, resolve, sep } = require('node:path');

const repositoryRoot = resolve(__dirname, '../..');
const defaultFirebaseIgnore = [
    'node_modules',
    '.git',
    'firebase-debug.log',
    'firebase-debug.*.log',
    '*.local',
    '.runtimeconfig.json',
];

function functionConfig(root) {
    const firebase = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8'));
    const configured = Array.isArray(firebase.functions) ? firebase.functions[0] : firebase.functions;
    if (!configured || typeof configured.source !== 'string') {
        throw new Error('Firebase Functions source configuration is missing');
    }
    return configured;
}

function isIgnored(fullPath, patterns) {
    return patterns.some(pattern => minimatch(fullPath, pattern, { matchBase: true, dot: true }));
}

function sourceFiles(sourceDir, patterns, currentDir = sourceDir) {
    const files = [];
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
        const fullPath = join(currentDir, entry.name);
        if (isIgnored(fullPath, patterns)) continue;
        if (entry.isDirectory()) {
            files.push(...sourceFiles(sourceDir, patterns, fullPath));
        } else if (entry.isFile()) {
            files.push(relative(sourceDir, fullPath).split(sep).join('/'));
        }
    }
    return files.sort();
}

function prohibitedReason(file) {
    if (/(^|\/)\.generated(\/|$)/.test(file)) return 'generated corpus artifact';
    if (/(^|\/)(?:noor-corpus|corpus-artifacts?)(\/|$)/i.test(file)) return 'local corpus artifact';
    if (/(^|\/)(?:credentials?|secrets?)(?:[._/-]|$)/i.test(file)) return 'credential or secret';
    if (/(^|\/)(?:\.env|.*\.local)(?:[._/-]|$)/i.test(file)) return 'local environment file';
    if (/(^|\/)(?:DerivedData|local[-_.]?qa|qa[-_.]|test[-_.]?telemetry)(\/|$)/i.test(file)) return 'local QA/telemetry artifact';
    if (/\.(?:zip|tar|tgz|gz)$/i.test(file)) return 'archive';
    return null;
}

function assertDeploymentPackageScope(root = repositoryRoot) {
    const config = functionConfig(root);
    const sourceDir = resolve(root, config.source);
    if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
        throw new Error(`Firebase Functions source directory is missing: ${sourceDir}`);
    }

    const patterns = [...(config.ignore || defaultFirebaseIgnore)];
    patterns.push('firebase-debug.log', 'firebase-debug.*.log', '.runtimeconfig.json');
    const files = sourceFiles(sourceDir, patterns);
    const prohibited = files
        .map(file => ({ file, reason: prohibitedReason(file) }))
        .filter(item => item.reason !== null);
    if (prohibited.length > 0) {
        throw new Error(`Prohibited deployment package path(s): ${prohibited.map(item => `${item.file} (${item.reason})`).join(', ')}`);
    }

    const generatedIgnored = patterns.some(pattern => pattern === '.generated' || pattern === '**/.generated');
    if (!generatedIgnored) {
        throw new Error('Firebase Functions ignore rules must exclude generated local artifacts with .generated');
    }

    return { sourceDir, files, ignore: patterns };
}

if (require.main === module) {
    try {
        const result = assertDeploymentPackageScope();
        process.stdout.write(`DEPLOYMENT PACKAGE SCOPE passed files=${result.files.length} generatedCorpus=excluded\n`);
    } catch (error) {
        process.stderr.write(`${error instanceof Error ? error.message : 'Deployment package scope check failed'}\n`);
        process.exitCode = 1;
    }
}

module.exports = { assertDeploymentPackageScope, prohibitedReason, sourceFiles };
