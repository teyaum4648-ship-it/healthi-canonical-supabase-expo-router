// EAS-only hook: stop an incomplete store build before native compilation.
if (process.env.EAS_BUILD_PLATFORM === 'ios' && process.env.EAS_BUILD_PROFILE === 'production') {
  require('./check-ios-release-config.cjs');
}
