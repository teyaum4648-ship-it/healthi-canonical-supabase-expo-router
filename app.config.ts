import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  // What people see. slug and scheme stay 'healthi' so the Expo project and sign-in links keep working.
  name: 'daywoven',
  slug: 'healthi',
  scheme: 'healthi',
  version: '0.1.0',
  icon: './public/icons/healthi-icon-1024.png',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './public/icons/healthi-icon-192.png',
    name: 'daywoven',
    shortName: 'daywoven',
    lang: 'en',
    scope: '/',
    themeColor: '#000000',
    backgroundColor: '#000000',
    description: 'Adaptive wellness guidance for your day.',
    display: 'standalone',
    startUrl: '/',
    orientation: 'portrait',
    barStyle: 'black-translucent',
    preferRelatedApplications: false
  },
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#000000'
    },
    // Read-only: daywoven brings sleep and steps in and never writes to Health Connect.
    permissions: ['android.permission.health.READ_SLEEP', 'android.permission.health.READ_STEPS']
  },
  plugins: [
    'expo-router',
    [
      'expo-secure-store',
      {
        configureAndroidBackup: true
      }
    ],
    [
      'expo-camera',
      {
        barcodeScannerEnabled: true,
        cameraPermission: 'daywoven uses the camera to scan product barcodes and to estimate a meal from a photo. You can also enter a barcode manually or search for a food.',
        microphonePermission: false,
        recordAudioAndroid: false
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'daywoven reads a photo you choose so it can estimate the foods in that meal. Photos are used for that estimate and are not stored by daywoven.',
        cameraPermission: 'daywoven uses the camera to estimate a meal from a photo you take.',
        microphonePermission: false
      }
    ],
    /*
     * Apple Health and Health Connect, read-only. Both need a build of the app made with
     * these plugins; Expo Go and the web demo show them as unavailable.
     */
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription: 'daywoven reads your sleep and steps so your sleep rhythm and readiness can use what your phone already knows. Nights you log yourself always stay as you logged them.',
        NSHealthUpdateUsageDescription: false,
        background: false
      }
    ],
    'react-native-health-connect',
    ['expo-build-properties', { android: { minSdkVersion: 26 } }]
  ]
};

export default config;
