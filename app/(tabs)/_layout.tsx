import { router, Tabs, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { useAppState } from "@/state/AppState";
import { colors, typography } from "@/theme/tokens";
import { standardTopInset } from "@/theme/safeArea";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function CurvedTabBarBackground() {
  return (
    <View pointerEvents="none" style={styles.tabBarBgWrap}>
      <View style={styles.tabBarBase} />
      <View style={styles.topLineRow}>
        <View style={styles.topLineSegment} />
        <View style={styles.topLineGap} />
        <View style={styles.topLineSegment} />
      </View>
      <View style={styles.tabBarHump} />
    </View>
  );
}

export default function TabsLayout() {
  const { startScanOrPaywall } = useAppState();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        sceneStyle: {
          backgroundColor: colors.bg,
          paddingTop: route.name === "scan" ? 0 : standardTopInset(insets.top)
        },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: "#8F95A1",
        tabBarStyle: route.name === "scan" ? styles.tabBarHidden : styles.tabBar,
        tabBarBackground: () => <CurvedTabBarBackground />,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIconStyle: { marginTop: 2 },
        tabBarItemStyle: route.name === "scan" ? styles.scanItem : styles.sideItem,
        tabBarIcon: ({ color, size, focused }) => {
          const map: Record<string, keyof typeof Ionicons.glyphMap> = {
            home: focused ? "home" : "home-outline",
            collection: focused ? "albums" : "albums-outline",
            scan: "scan",
            history: focused ? "time" : "time-outline",
            settings: focused ? "settings" : "settings-outline"
          };
          if (route.name === "scan") {
            return <Ionicons name={map.scan} color={colors.white} size={28} />;
          }
          return <Ionicons name={map[route.name] ?? "ellipse"} color={color} size={size} />;
        }
      })}
    >
      <Tabs.Screen name="home" options={{ title: "Home" }} />
      <Tabs.Screen
        name="scan"
        options={{
          title: "",
          tabBarButton: (props) => (
            <View style={styles.scanWrap}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={props.accessibilityState}
                accessibilityLabel={props.accessibilityLabel}
                testID={props.testID}
                onPress={() => {
                  if (!startScanOrPaywall("tab")) return;
                  router.push({
                    pathname: "/(tabs)/scan",
                    params: { origin: pathname }
                  });
                }}
                onLongPress={props.onLongPress}
                style={({ pressed }) => [styles.scanButton, pressed && styles.scanPressed]}
              >
                <Ionicons name="scan" size={28} color={colors.white} />
              </Pressable>
            </View>
          )
        }}
      />
      <Tabs.Screen name="collection" options={{ title: "Collection" }} />
      {/* Hidden fallback routes stay out of the active tab UI. */}
      <Tabs.Screen name="history" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 72,
    borderTopWidth: 0,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: "transparent",
    position: "absolute"
  },
  tabBarHidden: {
    display: "none"
  },
  tabBarBgWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "transparent"
  },
  tabBarBase: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0
    ,
    height: 72,
    backgroundColor: colors.white
  },
  topLineRow: {
    position: "absolute",
    top: 6,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center"
  },
  topLineSegment: {
    flex: 1,
    height: 1,
    backgroundColor: "#E8E8E8"
  },
  topLineGap: {
    width: 100
  },
  tabBarHump: {
    position: "absolute",
    alignSelf: "center",
    top: -34,
    width: 100,
    height: 40,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: "#E8E8E8"
  },
  tabLabel: {
    ...typography.Caption,
    fontSize: 10,
    lineHeight: 12
  },
  sideItem: {
    paddingTop: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingBottom: 0
  },
  scanItem: {
    marginTop: -2
  },
  scanWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start"
  },
  scanButton: {
    position: "absolute",
    top: -22,
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.accentPrimary,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 6
  },
  scanPressed: {
    transform: [{ scale: 0.98 }]
  }
});
