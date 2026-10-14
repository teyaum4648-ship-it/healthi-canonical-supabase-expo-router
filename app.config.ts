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
    }
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
        recordAudioAndroid: false
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'daywoven reads a photo you choose so it can estimate the foods in that meal. Photos are used for that estimate and are not stored by daywoven.',
        cameraPermission: 'daywoven uses the camera to estimate a meal from a photo you take.'
      }
    ]
  ]
};

export default config;
