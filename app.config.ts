const metaAppId = process.env.EXPO_PUBLIC_META_APP_ID ?? "";
const metaClientToken = process.env.EXPO_PUBLIC_META_CLIENT_TOKEN ?? "";
const bundleIdentifier = process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ?? "com.cardatlas.app";
const expoProjectId =
  process.env.EXPO_PUBLIC_EXPO_PROJECT_ID ??
  "784382dd-1eb7-4598-b5ff-4b3315fd14c8";

const plugins = [];

plugins.push("expo-router");
plugins.push("expo-notifications");
plugins.push("expo-tracking-transparency");
plugins.push([
  "expo-camera",
  {
    cameraPermission: "Allow CardAtlas to scan the front and back of your cards.",
    microphonePermission: false,
    recordAudioAndroid: false
  }
]);
plugins.push([
  "expo-image-picker",
  {
    photosPermission: "Allow CardAtlas to use photos of your cards from your library.",
    cameraPermission: "Allow CardAtlas to take photos of your cards.",
    microphonePermission: false
  }
]);

if (metaAppId) {
  const metaPlugin = /** @type {any} */ ([
    "react-native-fbsdk-next",
    {
      appID: metaAppId,
      clientToken: metaClientToken,
      displayName: "CardAtlas",
      scheme: `fb${metaAppId}`,
      iosUserTrackingPermission: false,
      advertiserIDCollectionEnabled: false,
      autoLogAppEventsEnabled: false,
      isAutoInitEnabled: false
    }
  ]);
  plugins.push(metaPlugin);
}

const config = {
  name: "CardAtlas",
  slug: "cardlens",
  scheme: "cardlens",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/Final App Icon.png",
  splash: {
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier,
    infoPlist: {
      NSUserTrackingUsageDescription:
        "CardAtlas uses tracking permission to measure ad attribution and improve marketing performance after you allow it."
    },
    // Keep this ahead of the latest TestFlight build.
    buildNumber: "58"
  },
  android: {
    package: bundleIdentifier,
    adaptiveIcon: {
      foregroundImage: "./assets/Final App Icon.png",
      backgroundColor: "#ffffff"
    }
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
