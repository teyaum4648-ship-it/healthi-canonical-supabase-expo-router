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
    /*
     * The App Store identity. It is permanent once the first build is uploaded, so if a
     * different one is already registered in App Store Connect, set IOS_BUNDLE_IDENTIFIER
     * rather than editing this default.
     */
    bundleIdentifier: process.env.IOS_BUNDLE_IDENTIFIER ?? 'com.daywovenapp.daywoven',
    buildNumber: '1',
    /*
     * iPhone only. The screens are designed for a phone in portrait, and an iPad build
     * would be reviewed on an iPad; the iPhone app still runs on iPad in compatibility mode.
     */
    supportsTablet: false,
    config: {
      // Only standard HTTPS and the OS keychain: exempt, so uploads skip the export question.
      usesNonExemptEncryption: false
    },
    /*
     * Apple's privacy manifest. No tracking and no tracking domains. The collected types
     * match the App Store privacy label in docs/legal/APP-STORE-SUBMISSION.md — change
     * both together. The API reasons cover what React Native and Expo themselves use.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [
        ['NSPrivacyCollectedDataTypeHealth', true],
        ['NSPrivacyCollectedDataTypeFitness', true],
        ['NSPrivacyCollectedDataTypeEmailAddress', true],
        ['NSPrivacyCollectedDataTypeName', true],
        ['NSPrivacyCollectedDataTypeUserID', true],
        ['NSPrivacyCollectedDataTypePhotosorVideos', false]
      ].map(([type, linked]) => ({
        NSPrivacyCollectedDataType: type as string,
        NSPrivacyCollectedDataTypeLinked: linked as boolean,
        NSPrivacyCollectedDataTypeTracking: false,
        NSPrivacyCollectedDataTypePurposes: ['NSPrivacyCollectedDataTypePurposeAppFunctionality']
      })),
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] }
      ]
    }
  },
  android: {
    package: process.env.ANDROID_PACKAGE ?? 'com.daywovenapp.daywoven',
    versionCode: 1,
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
        configureAndroidBackup: true,
        // The session token is kept in the keychain without biometrics, so Face ID is never asked for.
        faceIDPermission: false
      }
    ],
    [
      'expo-camera',
      {
        barcodeScannerEnabled: true,
        cameraPermission: 'daywoven uses the camera to scan product barcodes and to estimate a meal from a photo. You can also enter a barcode manually or search for a food.',
        // No video is recorded, so the microphone is never asked for.
        microphonePermission: false,
        recordAudioAndroid: false
      }
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'daywoven reads a photo you choose so it can estimate the foods in that meal. With your permission the photo is sent to an AI service for that estimate; daywoven does not store it.',
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
