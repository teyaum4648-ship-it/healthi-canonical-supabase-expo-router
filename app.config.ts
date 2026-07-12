import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Healthi',
  slug: 'healthi',
  scheme: 'healthi',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true
  },
  android: {
    adaptiveIcon: {
      backgroundColor: '#F7F3EC'
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
