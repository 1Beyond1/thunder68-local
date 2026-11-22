'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const testsDir = path.join(__dirname, '..', 'tests');
const files = fs
  .readdirSync(testsDir)
  .filter((name) => name.endsWith('.test.cjs'))
  .sort()
  .map((name) => path.join(testsDir, name));

if (files.length === 0) {
  console.error('No *.test.cjs files found in tests/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(result.status ?? 1);
