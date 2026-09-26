import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Healthi',
  slug: 'healthi',
  scheme: 'healthi',
  version: '0.1.0',
  icon: './public/icons/healthi-icon-1024.png',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  web: {
    bundler: 'metro',
    output: 'single',
    favicon: './public/icons/healthi-icon-192.png',
    name: 'Healthi',
    shortName: 'Healthi',
    lang: 'en',
    scope: '/',
    themeColor: '#F5F5F7',
    backgroundColor: '#F5F5F7',
    description: 'Adaptive wellness guidance for your day.',
    display: 'standalone',
    startUrl: '/',
    orientation: 'portrait',
    barStyle: 'default',
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
        cameraPermission: 'Healthi uses the camera to scan product barcodes and to estimate a meal from a photo. You can also enter a barcode manually or search for a food.',
        recordAudioAndroid: false
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'Healthi reads a photo you choose so it can estimate the foods in that meal. Photos are used for that estimate and are not stored by Healthi.',
        cameraPermission: 'Healthi uses the camera to estimate a meal from a photo you take.'
      }
    ]
  ]
};

export default config;
