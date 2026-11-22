const {execFileSync} = require('node:child_process');
const path = require('node:path');

const FORBIDDEN_RULES = Object.freeze([
  {name: 'app/vendor/', test: p => p.startsWith('app/vendor/')},
  {name: 'app/keyboard-layout.json', test: p => p === 'app/keyboard-layout.json'},
  {name: 'research/decoded.js', test: p => p === 'research/decoded.js'},
  {name: 'research/official-main.js', test: p => p === 'research/official-main.js'},
  {name: 'research/decode.cjs', test: p => p === 'research/decode.cjs'},
  {name: 'research/*.zip', test: p => /^research\/.*\.zip$/i.test(p)},
  {name: 'release/', test: p => p.startsWith('release/')},
  {name: 'data/', test: p => p.startsWith('data/')},
  {name: 'output/', test: p => p.startsWith('output/')},
  {name: '.tmp/', test: p => p.startsWith('.tmp/')}
]);

function normalizeGitPath(rawPath) {
  return String(rawPath || '').trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

function findForbiddenTrackedFiles(trackedFiles) {
  const violations = [];
  for (const raw of trackedFiles) {
    const normalized = normalizeGitPath(raw);
    if (!normalized) continue;
    for (const rule of FORBIDDEN_RULES) {
      if (rule.test(normalized)) {
        violations.push({path: normalized, rule: rule.name});
        break;
      }
    }
  }
  return violations;
}

function runComplianceCheck(root = path.resolve(__dirname, '..')) {
  const output = execFileSync('git', ['ls-files'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true
  });
  const trackedFiles = output.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const violations = findForbiddenTrackedFiles(trackedFiles);
  return {
    checkedAt: new Date().toISOString(),
    trackedFileCount: trackedFiles.length,
    ok: violations.length === 0,
    violations
  };
}

if (require.main === module) {
  try {
    const result = runComplianceCheck();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) {
      console.error('Compliance check failed: forbidden files are tracked by Git.');
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Compliance check error:', error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  FORBIDDEN_RULES,
  findForbiddenTrackedFiles,
  runComplianceCheck
};
