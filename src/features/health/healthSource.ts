import { unavailableHealthSource, type HealthSource } from './healthImport';

/**
 * The health-data reader for the web build, and the fallback everywhere else.
 *
 * The iPhone and Android readers live beside this file as healthSource.ios.ts and
 * healthSource.android.ts, and the bundler picks them on those platforms. The web demo
 * has no Apple Health or Health Connect to reach, so it gets the unavailable source and
 * every screen shows the honest "not here" state.
 */
export const healthSource: HealthSource = unavailableHealthSource;
