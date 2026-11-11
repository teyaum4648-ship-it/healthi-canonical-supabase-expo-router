#!/usr/bin/env node
// Local, read-only configuration gate. This does not certify compliance or create/sign a build.
const fs = require('node:fs');
const path = require('node:path');
const { Buffer } = require('node:buffer');
const { getConfig } = require('@expo/config');
const { exp } = getConfig(process.cwd(), { skipSDKVersionRequirement: true });
const failures = [];
const identifier = exp.ios?.bundleIdentifier;
if (!identifier || !/^[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+){2,}$/.test(identifier) || /placeholder|anonymous|example|your-project/i.test(identifier)) {
  failures.push('Set ios.bundleIdentifier to the identifier registered to your Apple team.');
}
if (process.env.EXPO_PUBLIC_DEMO_MODE !== 'false') failures.push('Explicitly set EXPO_PUBLIC_DEMO_MODE=false for the account-mode production build.');
if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(exp.extra?.eas?.projectId || '')) failures.push('Set EXPO_PROJECT_ID to your actual EAS project UUID.');
for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SITE_URL', 'EXPO_PUBLIC_FOOD_SEARCH_URL']) {
  let valid = false;
  try {
    const value = process.env[key] || '';
    const url = key === 'EXPO_PUBLIC_FOOD_SEARCH_URL' && value.startsWith('/')
      ? new URL(value, process.env.EXPO_PUBLIC_SITE_URL) : new URL(value);
    valid = url.protocol === 'https:' && !url.username && !url.password && !/localhost|example|your-project|\.invalid$|\.test$|^127\.|^0\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\.|^\[::1\]$/.test(url.hostname);
  } catch { /* report names, never values */ }
  if (!valid) failures.push(`Set ${key} to the verified production HTTPS service.`);
}
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
let privileged = key.startsWith('sb_secret_');
let publicKey = /^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(key);
try {
  const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  privileged ||= payload.role === 'service_role';
  publicKey ||= payload.role === 'anon' && key.split('.').length === 3;
} catch { /* a modern publishable key need not be a JWT */ }
if (!publicKey || /your-public|placeholder/i.test(key)) failures.push('Configure the public Supabase anon/publishable key.');
if (privileged) failures.push('A privileged Supabase credential must never be an EXPO_PUBLIC value. Remove it and rotate it through your backend provider.');
const legalDir = path.join(process.cwd(), 'public/legal');
// The public mailing address is intentionally excluded from public Git history.
// EAS receives it as a Sensitive build variable; the completed policy is served by Cloudflare.
const publicMailingAddress = process.env.DAYWOVEN_PUBLIC_MAILING_ADDRESS?.trim() || '';
if (!publicMailingAddress || publicMailingAddress.length < 10 || /placeholder|example/i.test(publicMailingAddress)) {
  failures.push('Configure DAYWOVEN_PUBLIC_MAILING_ADDRESS as a Sensitive EAS production variable; it must match the public legal policy.');
}
const unfinished = fs.readdirSync(legalDir).filter(file => {
  if (!file.endsWith('.html')) return false;
  const content = fs.readFileSync(path.join(legalDir, file), 'utf8');
  const sanitized = content.replace(/\\{\\{BUSINESS_ADDRESS\\}\\}/g, publicMailingAddress);
  return /\\{\\{[A-Z_]+\\}\\}/.test(sanitized);
});
if (unfinished.length) failures.push(`Finish factual legal documents: ${unfinished.join(', ')}.`);
if (process.env.EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED === 'true') {
  const publicRevenueCatKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY || '';
  if (!/^appl_[A-Za-z0-9]+$/.test(publicRevenueCatKey)) failures.push('Enabled iOS subscriptions require a platform-specific public RevenueCat Apple SDK key.');
  if (!process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID) failures.push('Set EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID for enabled subscriptions.');
}
if (failures.length) {
  console.error('iOS release configuration is incomplete:');
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else console.log('Release configuration checks passed. Native signing, production services, account deletion, privacy disclosures and device testing still require verification.');
