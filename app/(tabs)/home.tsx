import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { ValuePanel } from "@/components/ValuePanel";
import { PriceText } from "@/components/PriceText";
import { useAppState } from "@/state/AppState";
import { useHomeDashboard } from "@/hooks/useHomeDashboard";
import { useAuth } from "@/features/auth";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { marketPulseService } from "@/services/marketPulse/MarketPulseService";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import type { MarketPulseItem } from "@/types";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";

const heroImage = require("../../assets/Best Hero Image.jpeg");
const logoImage = require("../../assets/New Logo.png");
const ebayLogoImage = require("../../assets/Ebay Logo.png");

function freshnessLabel(isoDate: string | null): string {
  if (!isoDate) return "New listing";
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return "New listing";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60)));
  if (diffMinutes < 60) return `New ${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `New ${diffHours}h ago`;
  return "Newly listed";
}

function recentScanLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "Scanned recently";
  const ts = Date.parse(isoDate);
  if (!Number.isFinite(ts)) return "Scanned recently";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - ts) / (1000 * 60)));
  if (diffMinutes < 60) return `Scanned ${Math.max(diffMinutes, 1)}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Scanned ${diffHours}h ago`;
  if (diffHours < 48) return "Scanned yesterday";
  const diffDays = Math.floor(diffHours / 24);
  return `Scanned ${diffDays}d ago`;
}

function rarityColor(label: string | null | undefined): string {
  const normalized = (label ?? "").toLowerCase();
  if (normalized === "notable") return "#5B6F95";
  if (normalized === "rare") return "#5A4B88";
  if (normalized === "elite") return "#A47A21";
  if (normalized === "grail") return "#8F5A29";
  return "#6F7682";
}

function rarityVisuals(label: string | null | undefined) {
  const normalized = (label ?? "").toLowerCase();
  if (normalized === "notable") {
    return {
      auraColor: "rgba(91,111,149,0.14)",
      auraOpacity: 0.34,
      accentColor: "#5B6F95",
      dotGlow: false,
      cardLift: null
    };
  }
  if (normalized === "rare") {
    return {
      auraColor: "rgba(90,75,136,0.18)",
      auraOpacity: 0.44,
      accentColor: "#5A4B88",
      dotGlow: true,
      cardLift: null
    };
  }
  if (normalized === "elite") {
    return {
      auraColor: "rgba(164,122,33,0.2)",
      auraOpacity: 0.48,
      accentColor: "#A47A21",
      dotGlow: true,
      cardLift: styles.recentCardElite
    };
  }
  if (normalized === "grail") {
    return {
      auraColor: "rgba(143,90,41,0.26)",
      auraOpacity: 0.56,
      accentColor: "#8F5A29",
      dotGlow: true,
      cardLift: styles.recentCardGrail
    };
  }

  return {
    auraColor: "transparent",
    auraOpacity: 0,
    accentColor: "#D4D9E1",
    dotGlow: false,
    cardLift: null
  };
}

export default function HomeTab() {
  const scrollRef = useRef<ScrollView>(null);
  const { history, enterAiOrPaywall, consumeSessionPaywallTrigger, presentPaywall, startScanOrPaywall } = useAppState();
  const { preferences } = useAppPreferences();
  const { session } = useAuth();
  const homeDashboard = useHomeDashboard();
  const totalValue = homeDashboard.portfolioValue;
  const recentScans = history.filter((item) => Boolean(item.imageFront?.trim())).slice(0, 8);
  const scansExhausted = homeDashboard.scansRemaining <= 0;
  const scansRemainingClamped = Math.max(0, Math.min(3, homeDashboard.scansRemaining));
  const [marketPulse, setMarketPulse] = useState<MarketPulseItem[]>([]);
  const [marketPulseLoading, setMarketPulseLoading] = useState(true);
  const [marketPulseError, setMarketPulseError] = useState<string | null>(null);
  const [marketPulseIsMock, setMarketPulseIsMock] = useState(false);
  const [marketPulseSource, setMarketPulseSource] = useState<"mock" | "ebay">("mock");
  const [marketPulseDidTriggerBackgroundRefresh, setMarketPulseDidTriggerBackgroundRefresh] = useState(false);
  const [marketPulseRefreshedAt, setMarketPulseRefreshedAt] = useState<string | null>(null);
  const hasTrackedPulseView = useRef(false);
  const marketPulseProviderEnv = String(process.env.EXPO_PUBLIC_MARKET_PULSE_PROVIDER ?? "unset");
  const appVersion = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "unknown";
  const buildNumber = Constants.expoConfig?.ios?.buildNumber ?? Constants.nativeBuildVersion ?? "unknown";
  const bundleIdentifier =
    Constants.expoConfig?.ios?.bundleIdentifier ??
    process.env.EXPO_PUBLIC_BUNDLE_IDENTIFIER ??
    "unknown";

  useFocusEffect(
    useCallback(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      if (consumeSessionPaywallTrigger()) {
        presentPaywall("session_gate");
      }
    }, [consumeSessionPaywallTrigger, presentPaywall])
  );

  useEffect(() => {
    let active = true;

    const loadFeed = async () => {
      setMarketPulseLoading(true);
      setMarketPulseError(null);
      try {
        const feed = await marketPulseService.getMarketPulseFeed(20);
        if (!active) return;
        setMarketPulse(feed.items);
        setMarketPulseIsMock(feed.isMock);
        setMarketPulseSource(feed.source);
        setMarketPulseError(feed.errorMessage ?? null);
        setMarketPulseDidTriggerBackgroundRefresh(Boolean(feed.didTriggerBackgroundRefresh));
        setMarketPulseRefreshedAt(feed.refreshedAt ?? null);

        if (feed.didTriggerBackgroundRefresh) {
          setTimeout(() => {
            void marketPulseService.getMarketPulseFeed(20).then((next) => {
              if (!active) return;
              setMarketPulse(next.items);
              setMarketPulseIsMock(next.isMock);
              setMarketPulseSource(next.source);
              setMarketPulseError(next.errorMessage ?? null);
              setMarketPulseDidTriggerBackgroundRefresh(Boolean(next.didTriggerBackgroundRefresh));
              setMarketPulseRefreshedAt(next.refreshedAt ?? null);
            });
          }, 900);
        }
      } catch (error) {
        if (!active) return;
        setMarketPulseError(error instanceof Error ? error.message : "Unable to load Market Pulse");
        setMarketPulseDidTriggerBackgroundRefresh(false);
      } finally {
        if (active) setMarketPulseLoading(false);
      }
    };

    if (session?.appUserId) {
      void loadFeed();
    } else {
      setMarketPulse([]);
      setMarketPulseLoading(false);
      setMarketPulseError(null);
      setMarketPulseDidTriggerBackgroundRefresh(false);
      setMarketPulseRefreshedAt(null);
    }

    return () => {
      active = false;
    };
  }, [session?.appUserId]);

  useEffect(() => {
    if (!marketPulse.length || hasTrackedPulseView.current) return;
    analyticsService.track(ANALYTICS_EVENTS.marketPulseViewed, {
      source: marketPulseSource,
      count: marketPulse.length,
      isMock: marketPulseIsMock
    });
    hasTrackedPulseView.current = true;
  }, [marketPulse, marketPulseSource, marketPulseIsMock]);

  const openPulseItem = async (item: MarketPulseItem) => {
    analyticsService.track(ANALYTICS_EVENTS.marketPulseItemOpened, {
      source: item.source,
      listingId: item.sourceListingId ?? item.id,
      price: item.price ?? undefined,
      isMock: item.isMock
    });

    if (!item.itemWebUrl) return;
    const supported = await Linking.canOpenURL(item.itemWebUrl);
    if (!supported) return;
    await Linking.openURL(item.itemWebUrl);
  };

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brandLogoFrame}>
          <Image source={logoImage} style={styles.brandLogo} resizeMode="contain" />
        </View>
        <View style={styles.statusCapsule}>
          <Pressable
            onPress={() => presentPaywall("discovery")}
            style={({ pressed }) => [
              styles.scansSegment,
              pressed && styles.segmentPressed
            ]}
          >
            <Text style={[styles.scansLabel, scansExhausted && styles.scansLabelExhausted]}>
              <Text style={styles.scansValue}>{homeDashboard.scansRemaining}</Text> scans left
            </Text>
            <View style={styles.scanMeterRow}>
              {[0, 1, 2].map((index) => (
                <View
                  key={index}
                  style={[
                    styles.scanMeterStep,
                    index < scansRemainingClamped
                      ? styles.scanMeterStepFilled
                      : styles.scanMeterStepEmpty
                  ]}
                />
              ))}
            </View>
          </Pressable>

          <Pressable
            onPress={() => presentPaywall("discovery")}
            style={({ pressed }) => [styles.proSegment, pressed && styles.segmentPressed]}
          >
            <Ionicons name="diamond-outline" size={13} color="#FFFFFF" />
            <Text style={styles.proText}>Pro</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.heroSection}>
        <View style={styles.heroBannerWrap}>
          <Image source={heroImage} style={styles.heroBanner} />
          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.28)"]}
            style={styles.heroOverlay}
            pointerEvents="none"
          />
        </View>
        <View style={styles.valueFloat}>
          <View style={styles.valueFloatInner}>
            <ValuePanel value={totalValue} condition={`${homeDashboard.cardCount} cards tracked`} borderless animateValue={false} />
          </View>
        </View>
      </View>

      <PrimaryButton
        title="Scan Card"
        onPress={() => {
          if (!startScanOrPaywall("home")) return;
          router.push({
            pathname: "/(tabs)/scan",
            params: { origin: "/(tabs)/home" }
          });
        }}
        style={styles.scanCta}
        leftIcon={<Ionicons name="scan" size={18} color={colors.white} />}
      />
      <SecondaryButton
        title="View Collection"
        onPress={() => router.push("/(tabs)/collection")}
        style={styles.collectionCta}
      />

      {preferences.collectorAiEnabled ? (
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Collector AI</Text>
          <Text style={styles.aiDesc}>Ask what stands out, what may be worth grading, and where the strongest collector opportunities are.</Text>
          <SecondaryButton
            title="Ask Collector AI"
            onPress={() => {
              analyticsService.track(ANALYTICS_EVENTS.askAiFromHome, {
                mode: "general"
              });
              if (!enterAiOrPaywall(undefined)) return;
              router.push("/chat/general");
            }}
            style={styles.aiBtn}
          />
        </View>
      ) : null}

      <View style={styles.marketPulseSection}>
        <View style={styles.marketPulseHeader}>
          <Text style={styles.marketPulseTitle}>Market Pulse</Text>
          {marketPulseIsMock ? <Text style={styles.marketPulseMeta}>Preview</Text> : null}
        </View>

        {marketPulseLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketPulseRail}>
            {[0, 1, 2].map((idx) => (
              <View key={idx} style={styles.marketPulseSkeleton} />
            ))}
          </ScrollView>
        ) : marketPulse.length === 0 ? (
          <View style={styles.marketPulseEmpty}>
            <Text style={styles.marketPulseEmptyText}>
              {marketPulseError ? "Market Pulse is temporarily unavailable." : "No Market Pulse items yet."}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.marketPulseRail}>
            {marketPulse.map((item) => (
              <Pressable key={item.id} style={styles.marketPulseCard} onPress={() => void openPulseItem(item)}>
                <View style={styles.marketPulseImageWrap}>
                  {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.marketPulseImage} /> : null}
                  {item.pulseReason ? (
                    <View style={styles.marketPulseTag}>
                      <Text style={styles.marketPulseTagText}>{item.pulseReason}</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.marketPulseCardTitle}>{item.title}</Text>
                {item.subtitle ? <Text numberOfLines={2} style={styles.marketPulseSubtitle}>{item.subtitle}</Text> : null}
                {item.price != null ? <PriceText value={item.price} style={styles.marketPulsePrice} /> : null}
                <View style={styles.marketPulseMetaRow}>
                  <Image source={ebayLogoImage} style={styles.marketPulseSourceLogo} resizeMode="contain" />
                  <Text style={styles.marketPulseSubline}>{freshnessLabel(item.itemOriginDate)}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        <View style={styles.debugBlock}>
          <Text style={styles.debugTitle}>Market Pulse Diagnostics</Text>
          <Text style={styles.debugLine}>provider env: {marketPulseProviderEnv}</Text>
          <Text style={styles.debugLine}>platform: {Platform.OS}</Text>
          <Text style={styles.debugLine}>app version: {appVersion}</Text>
          <Text style={styles.debugLine}>build: {buildNumber}</Text>
          <Text style={styles.debugLine}>bundle id: {bundleIdentifier}</Text>
          <Text style={styles.debugLine}>session app user: {session?.appUserId ?? "none"}</Text>
          <Text style={styles.debugLine}>loading: {marketPulseLoading ? "yes" : "no"}</Text>
          <Text style={styles.debugLine}>source: {marketPulseSource}</Text>
          <Text style={styles.debugLine}>is mock: {marketPulseIsMock ? "yes" : "no"}</Text>
          <Text style={styles.debugLine}>item count: {marketPulse.length}</Text>
          <Text style={styles.debugLine}>
            bg refresh requested: {marketPulseDidTriggerBackgroundRefresh ? "yes" : "no"}
          </Text>
          <Text style={styles.debugLine}>refreshed at: {marketPulseRefreshedAt ?? "none"}</Text>
          <Text style={styles.debugLine}>
            first item source: {marketPulse[0]?.source ?? "none"}
          </Text>
          <Text style={styles.debugLine}>
            first item title: {marketPulse[0]?.title ?? "none"}
          </Text>
          <Text style={styles.debugLine}>error: {marketPulseError ?? "none"}</Text>
        </View>
      </View>

      <View style={styles.recentSection}>
        <View style={styles.recentHeader}>
          <Text style={styles.recentTitle}>Recent Pulls</Text>
          <Pressable onPress={() => router.push("/collection/history")} style={styles.recentViewAllBtn}>
            <Text style={styles.recentViewAllText}>View All</Text>
            <Ionicons name="arrow-forward" size={13} color="#7A8291" />
          </Pressable>
        </View>
        {recentScans.length === 0 ? (
          <View style={styles.recentEmptyCard}>
            <View style={styles.recentEmptyIconWrap}>
              <Ionicons name="time-outline" size={18} color="#7E7E84" />
            </View>
            <Text style={styles.recentEmptyTitle}>No scans yet</Text>
            <Text style={styles.recentEmptyDesc}>
              Your recently scanned cards will appear here so you can quickly reopen results.
            </Text>
            <Pressable
              onPress={() => {
                if (!startScanOrPaywall("home")) return;
                router.push({
                  pathname: "/(tabs)/scan",
                  params: { origin: "/(tabs)/home" }
                });
              }}
              style={styles.recentEmptyAction}
            >
              <Text style={styles.recentEmptyActionText}>Go to Scan</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRail}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={178}
          >
            {recentScans.map((item) => {
              const visuals = rarityVisuals(item.rarityLabel);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => router.push(`/results/${item.id}`)}
                  style={({ pressed }) => [styles.recentCard, visuals.cardLift, pressed && styles.recentCardPressed]}
                >
                  <View style={styles.recentImageWrap}>
                    <View
                      style={[
                        styles.recentImageAura,
                        {
                          backgroundColor: visuals.auraColor,
                          opacity: visuals.auraOpacity
                        }
                      ]}
                    />
                    <Image source={{ uri: item.imageFront }} style={styles.recentImage} resizeMode="cover" />
                  </View>
                  <View
                    style={[
                      styles.recentImageAccent,
                      { backgroundColor: visuals.accentColor }
                    ]}
                  />
                  <View style={styles.recentRarityRow}>
                    <View
                      style={[
                        styles.recentRarityDot,
                        { backgroundColor: rarityColor(item.rarityLabel) },
                        visuals.dotGlow ? styles.recentRarityDotGlow : null
                      ]}
                    />
                    <Text style={styles.recentRarityText}>{item.rarityLabel}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.recentName}>{item.playerName}</Text>
                  <PriceText value={item.referenceValue} style={styles.recentValue} />
                  <Text style={styles.recentMetaLine}>Ref Value - {recentScanLabel(item.dateScanned)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.backgroundPrimary },
  content: { padding: layout.pagePadding, paddingTop: 6, gap: 0, paddingBottom: 120 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 2
  },
  brandLogoFrame: {
    width: 160,
    height: 44,
    overflow: "hidden"
  },
  brandLogo: {
    width: 190,
    height: 44,
    marginLeft: -34
  },
  statusCapsule: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderColor: "#DEE1E5",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFFFF"
  },
  scansSegment: {
    minWidth: 114,
    paddingHorizontal: 10,
    paddingVertical: 6,
    justifyContent: "center",
    gap: 4,
    backgroundColor: "#FFFFFF"
  },
  scansLabel: {
    ...typography.Caption,
    color: "#2D2D2D",
    fontFamily: "Inter-Medium",
    fontSize: 10,
    lineHeight: 12
  },
  scansLabelExhausted: {
    color: "#696C71"
  },
  scansValue: {
    color: "#111111",
    fontFamily: "Inter-SemiBold"
  },
  scanMeterRow: {
    flexDirection: "row",
    gap: 3
  },
  scanMeterStep: {
    width: 12,
    height: 3,
    borderRadius: 2
  },
  scanMeterStepFilled: {
    backgroundColor: "#1F9D55"
  },
  scanMeterStepEmpty: {
    backgroundColor: "#C9CED4"
  },
  proSegment: {
    minWidth: 54,
    paddingHorizontal: 9,
    borderLeftWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    backgroundColor: "#111111"
  },
  segmentPressed: {
    opacity: 0.9
  },
  proText: {
    ...typography.Caption,
    color: "#FFFFFF",
    fontFamily: "Inter-SemiBold",
    fontSize: 10,
    lineHeight: 12
  },
  heroBannerWrap: {
    marginTop: 8,
    marginHorizontal: -layout.pagePadding,
    height: 286
  },
  heroBanner: {
    width: "100%",
    height: "100%"
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 110
  },
  heroSection: {
    position: "relative",
    marginBottom: 24
  },
  valueFloat: {
    marginTop: -72
  },
  valueFloatInner: {
    shadowColor: "#000000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 1
  },
  scanCta: {
    marginTop: 8
  },
  collectionCta: {
    marginTop: 10
  },
  aiCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    padding: 14,
    gap: 8
  },
  aiTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold",
    color: colors.accentPrimary
  },
  aiDesc: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  aiBtn: {
    marginTop: 4
  },
  recentSection: {
    marginTop: 28,
    gap: 12
  },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  marketPulseSection: {
    marginTop: 24,
    gap: 10
  },
  marketPulseHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  marketPulseTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold"
  },
  marketPulseMeta: {
    ...typography.Caption,
    color: "#8E97A7"
  },
  marketPulseRail: {
    gap: 10,
    paddingRight: 6
  },
  marketPulseSkeleton: {
    width: 170,
    height: 220,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#F2F3F6"
  },
  marketPulseEmpty: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    paddingVertical: 16,
    paddingHorizontal: 14
  },
  marketPulseEmptyText: {
    ...typography.BodyMedium,
    color: colors.textSecondary
  },
  marketPulseCard: {
    width: 170,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    padding: 8,
    gap: 6
  },
  debugBlock: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#E2E6EC",
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3
  },
  debugTitle: {
    ...typography.Caption,
    color: "#5F6B7C",
    fontFamily: "Inter-SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4
  },
  debugLine: {
    ...typography.Caption,
    color: "#243041",
    fontFamily: "Inter-Medium"
  },
  marketPulseImageWrap: {
    position: "relative",
    width: "100%",
    height: 112,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#EFF1F4"
  },
  marketPulseImage: {
    width: "100%",
    height: "100%"
  },
  marketPulseTag: {
    position: "absolute",
    left: 6,
    top: 6,
    borderRadius: 999,
    backgroundColor: "rgba(17,17,17,0.75)",
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  marketPulseTagText: {
    ...typography.Caption,
    color: "#FFFFFF",
    fontFamily: "Inter-Medium"
  },
  marketPulseCardTitle: {
    ...typography.BodyMedium,
    fontFamily: "Inter-Medium",
    color: colors.textPrimary,
    minHeight: 34
  },
  marketPulseSubtitle: {
    ...typography.Caption,
    color: "#6E7888",
    minHeight: 28,
    lineHeight: 15
  },
  marketPulsePrice: {
    ...typography.BodyMedium,
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold",
    fontVariant: ["tabular-nums"]
  },
  marketPulseSubline: {
    ...typography.Caption,
    color: "#7F8898"
  },
  marketPulseMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  marketPulseSourceLogo: {
    width: 24,
    height: 10
  },
  recentTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold",
    color: "#12161F"
  },
  recentViewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 2
  },
  recentViewAllText: {
    ...typography.Caption,
    color: "#727A89",
    fontFamily: "Inter-Medium"
  },
  recentRail: {
    gap: 13,
    paddingRight: 14
  },
  recentEmptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 8
  },
  recentEmptyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E6E6E8",
    backgroundColor: "#F8F8F9",
    alignItems: "center",
    justifyContent: "center"
  },
  recentEmptyTitle: {
    ...typography.H3,
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  recentEmptyDesc: {
    ...typography.Caption,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 280
  },
  recentEmptyAction: {
    marginTop: 2,
    paddingVertical: 2
  },
  recentEmptyActionText: {
    ...typography.BodyMedium,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  recentCard: {
    width: 168,
    borderWidth: 1,
    borderColor: "#E1E6EE",
    borderRadius: 16,
    backgroundColor: colors.white,
    paddingHorizontal: 9,
    paddingTop: 9,
    paddingBottom: 10,
    gap: 0,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.045,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1
  },
  recentCardElite: {
    shadowOpacity: 0.075,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2
  },
  recentCardGrail: {
    shadowOpacity: 0.09,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  recentCardPressed: {
    transform: [{ scale: 0.988 }],
    opacity: 0.96
  },
  recentRarityRow: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  recentRarityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  recentRarityText: {
    ...typography.Caption,
    color: "#616A79",
    fontFamily: "Inter-Medium"
  },
  recentImageWrap: {
    width: "100%",
    height: 188,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EEF2F7",
    borderWidth: 1,
    borderColor: "#E7ECF3"
  },
  recentImageAura: {
    position: "absolute",
    width: "90%",
    height: "86%",
    left: "5%",
    top: "7%",
    borderRadius: 14,
    zIndex: 0
  },
  recentImage: {
    width: "100%",
    height: "100%",
    zIndex: 1
  },
  recentImageAccent: {
    width: "100%",
    height: 2,
    borderRadius: 2,
    marginTop: 2
  },
  recentRarityDotGlow: {
    shadowColor: "#000000",
    shadowOpacity: 0.14,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1
  },
  recentName: {
    ...typography.BodyMedium,
    fontFamily: "Inter-SemiBold",
    color: "#141925",
    marginTop: 6,
    minHeight: 18,
    lineHeight: 18
  },
  recentValue: {
    ...typography.BodyMedium,
    fontFamily: "Inter-SemiBold",
    color: "#11151D",
    fontVariant: ["tabular-nums"],
    marginTop: 4
  },
  recentMetaLine: {
    ...typography.Caption,
    color: "#848D9D",
    marginTop: 3
  }
});

