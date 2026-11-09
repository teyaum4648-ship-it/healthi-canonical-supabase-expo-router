#!/usr/bin/env node
// Local, read-only configuration gate. This does not certify compliance or create/sign a build.
const fs = require('node:fs');
const path = require('node:path');
const { getConfig } = require('@expo/config');
const { exp } = getConfig(process.cwd(), { skipSDKVersionRequirement: true });
const failures = [];
const identifier = exp.ios?.bundleIdentifier;
if (!identifier || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+){2,}$/.test(identifier) || /placeholder|anonymous|example|your-project/i.test(identifier)) {
  failures.push('Set ios.bundleIdentifier to the identifier registered to your Apple team.');
}
if (process.env.EXPO_PUBLIC_DEMO_MODE !== 'false') failures.push('Explicitly set EXPO_PUBLIC_DEMO_MODE=false for the account-mode production build.');
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SITE_URL']) {
  let valid = false;
  try { const url = new URL(process.env[key]); valid = url.protocol === 'https:' && !/localhost|example|your-project/.test(url.hostname); } catch { /* report names, never values */ }
  if (!valid) failures.push(`Set ${key} to the verified production HTTPS service.`);
}
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
if (!key || /your-public|placeholder/i.test(key)) failures.push('Configure the public Supabase anon/publishable key.');
let privileged = key.startsWith('sb_secret_');
try { privileged ||= JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'service_role'; } catch { /* a modern publishable key need not be a JWT */ }
if (privileged) failures.push('A privileged Supabase credential must never be an EXPO_PUBLIC value. Remove it and rotate it through your backend provider.');
const legalDir = path.join(process.cwd(), 'public/legal');
const unfinished = fs.readdirSync(legalDir).filter(file => file.endsWith('.html') && /\{\{[A-Z_]+\}\}/.test(fs.readFileSync(path.join(legalDir, file), 'utf8')));
if (unfinished.length) failures.push(`Finish factual legal documents: ${unfinished.join(', ')}.`);
if (failures.length) {
  console.error('iOS release configuration is incomplete:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else console.log('Release configuration checks passed. Native signing, production services, account deletion, privacy disclosures and device testing still require verification.');
