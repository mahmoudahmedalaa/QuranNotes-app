const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { describe, it } = require('node:test');

const {
    assertDeploymentPackageScope,
} = require('./verify-deployment-package');

function fixtureRoot(ignore) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noor-deployment-scope-'));
    fs.mkdirSync(path.join(root, 'functions', 'lib', 'noor-rag'), { recursive: true });
    fs.mkdirSync(path.join(root, 'functions', '.generated', 'noor-corpus', 'fixture'), { recursive: true });
    fs.writeFileSync(path.join(root, 'firebase.json'), JSON.stringify({
        functions: [{ source: 'functions', ignore }],
    }));
    fs.writeFileSync(path.join(root, 'functions', 'lib', 'index.js'), 'exports.askNoorRagV1 = undefined;');
    fs.writeFileSync(path.join(root, 'functions', 'lib', 'noor-rag', 'callable.js'), '');
    fs.writeFileSync(path.join(root, 'functions', '.generated', 'noor-corpus', 'fixture', 'manifest.json'), '{}');
    return root;
}

describe('Noor Firebase deployment package scope', () => {
    it('excludes generated corpus artifacts using the configured Firebase ignore rules', () => {
        const result = assertDeploymentPackageScope(fixtureRoot(['.generated']));

        assert.equal(result.files.some(file => file.includes('.generated/noor-corpus')), false);
        assert.equal(result.files.includes('lib/index.js'), true);
        assert.equal(result.files.includes('lib/noor-rag/callable.js'), true);
    });

    it('fails when generated corpus artifacts would remain in the Firebase package', () => {
        assert.throws(
            () => assertDeploymentPackageScope(fixtureRoot([])),
            /prohibited deployment package path.*\.generated\/noor-corpus/i,
        );
    });
});
