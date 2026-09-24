import { unavailableHealthSource, type HealthSource } from './healthImport';

/**
 * The one place the app gets its health-data reader.
 *
 * Reading Apple Health or Health Connect needs a native module and a development build,
 * which Expo Go and the web demo cannot run. Until that module is added this is the
 * unavailable source, so every screen shows the honest "not connected yet" state; adding
 * the module means replacing this export with an adapter that implements HealthSource.
 */
export const healthSource: HealthSource = unavailableHealthSource;
