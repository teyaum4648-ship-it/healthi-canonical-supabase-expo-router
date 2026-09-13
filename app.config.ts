import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Healthi',
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
    name: 'Healthi',
    shortName: 'Healthi',
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
        cameraPermission: 'Healthi uses the camera to scan product barcodes. You can also enter a barcode manually.',
        recordAudioAndroid: false
      }
    ]
  ]
};

export default config;
