// Read-only check against hashes captured from the published Sites source tree.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'docs/live-demo-source-manifest.json'), 'utf8'));
const failures = [];
for (const [file, expected] of Object.entries(manifest.files)) {
  const target = path.resolve(root, file);
  if (!target.startsWith(root + path.sep)) { failures.push(`${file}: invalid path`); continue; }
  if (!fs.existsSync(target)) { failures.push(`${file}: missing`); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  if (actual !== expected) failures.push(`${file}: changed since published version ${manifest.version}`);
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`PASS: ${Object.keys(manifest.files).length} runtime/configuration files match live demo version ${manifest.version} (${manifest.sourceCommit.slice(0, 7)}).`);
}
