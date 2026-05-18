#!/usr/bin/env node

const { spawnSync } = require('node:child_process');

const args = process.argv.slice(2);
const passthrough = args.filter((arg) => arg !== '--write');
const shouldWrite = args.includes('--write');

const childArgs = [
  'scripts/manage-paywall-rollout.js',
  '--enabled=true',
  ...passthrough,
];

if (shouldWrite) {
  childArgs.push('--write');
}

const result = spawnSync(process.execPath, childArgs, {
  stdio: 'inherit',
  cwd: process.cwd(),
});

process.exit(result.status ?? 1);
