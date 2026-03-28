const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID ?? "";
const metaClientToken = process.env.EXPO_PUBLIC_META_CLIENT_TOKEN ?? "";
const bundleIdentifier = process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? "com.cardatlas.app";
const expoProjectId =
  process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ??
  "784382dd-1eb7-4598-b5ff-4b3315fd14c8";

const plugins: any[] = [
  "expo-router",
  "expo-notifications",
  [
    "expo-camera",
    {
      cameraPermission: "Allow CardAtlas to scan the front and back of your cards.",
      microphonePermission: false,
      recordAudioAndroid: false
    }
  ],
  [
    "expo-image-picker",
    {
      photosPermission: "Allow CardAtlas to use photos of your cards from your library.",
      cameraPermission: "Allow CardAtlas to take photos of your cards.",
      microphonePermission: false
    }
  ]
];

if (metaAppId) {
  plugins.push([
    "react-native-fbsdk-next",
    {
      appID: metaAppId,
      clientToken: metaClientToken,
      displayName: "CardAtlas",
      scheme: `fb${metaAppId}`,
      advertiserIDCollectionEnabled: true,
      autoLogAppEventsEnabled: true,
      isAutoInitEnabled: true
    }
  ]);
}

const config = {
  name: "CardAtlas",
  slug: "cardlens",
  scheme: "cardlens",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier,
    // Keep this ahead of the latest TestFlight build.
    buildNumber: "38"
  },
  android: {
    package: bundleIdentifier
  },
  plugins,
  extra: {
    eas: {
      projectId: expoProjectId
    }
  },
  experiments: {
    typedRoutes: true
  },
  description: "CardAtlas Expo app configuration."
};

export default config;
