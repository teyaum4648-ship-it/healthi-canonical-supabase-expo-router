const { createHash } = require('node:crypto');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Expo inlines these values into application code. A shared transform cache must
// not reuse an account bundle for demo mode, or a test endpoint for production.
// Hash public configuration only; never print values or include server secrets.
const publicEnvironment = Object.entries(process.env)
  .filter(([name]) => name.startsWith('EXPO_PUBLIC_'))
  .sort(([left], [right]) => left.localeCompare(right));
const environmentHash = createHash('sha256').update(JSON.stringify(publicEnvironment)).digest('hex');
config.cacheVersion = `${config.cacheVersion || '1'}:public-env:${environmentHash}`;

module.exports = config;
