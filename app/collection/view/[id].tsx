import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View, type ViewToken } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ResultDetails } from "@/components/ResultDetails";
import { useAppState } from "@/state/AppState";
import { colors, layout, typography } from "@/theme/tokens";
import { immersiveTopChromeInset, overlayChromeSpacerHeight } from "@/theme/safeArea";
import { getCollectionViewerContext } from "@/features/collection/viewerContext";

export default function CollectionViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, removeCollectionItem } = useAppState();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<(typeof cards)[number]>>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const orderedCards = useMemo(() => {
    const stored = getCollectionViewerContext();
    const sourceIds = stored?.orderedIds?.length ? stored.orderedIds : cards.map((card) => card.collectionItemId ?? card.id);
    const byKey = new Map(cards.map((card) => [card.collectionItemId ?? card.id, card]));
    const ordered = sourceIds.map((key) => byKey.get(key)).filter(Boolean) as typeof cards;
    if (ordered.length) return ordered;
    return [...cards].sort((a, b) => {
      const aTs = Date.parse(a.addedAt ?? a.dateScanned);
      const bTs = Date.parse(b.addedAt ?? b.dateScanned);
      return bTs - aTs;
    });
  }, [cards]);

  const initialIndex = useMemo(
    () => Math.max(0, orderedCards.findIndex((card) => (card.collectionItemId ?? card.id) === id)),
    [id, orderedCards]
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const currentItem = orderedCards[currentIndex] ?? orderedCards[0];

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!orderedCards.length) return;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: initialIndex, animated: false });
    });
  }, [initialIndex, orderedCards.length]);

  const closeViewer = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/collection");
  }, []);

  const removeCurrent = useCallback(async () => {
    const collectionItemId = currentItem?.collectionItemId;
    if (!collectionItemId) return;
    try {
      setRemovingId(collectionItemId);
      await removeCollectionItem(collectionItemId);
      router.replace("/(tabs)/collection");
    } catch {
      Alert.alert("Unable to remove", "This card could not be removed right now.");
    } finally {
      setRemovingId(null);
    }
  }, [currentItem?.collectionItemId, removeCollectionItem]);

  const confirmRemove = useCallback(async () => {
    if (!currentItem?.collectionItemId) return;
    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
      if (!globalThis.confirm("Remove this card from your collection?")) return;
      await removeCurrent();
      return;
    }

    Alert.alert("Remove card?", "This removes the card from your collection only.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void removeCurrent();
        }
      }
    ]);
  }, [currentItem?.collectionItemId, removeCurrent]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<ViewToken> }) => {
      const firstVisible = viewableItems.find((entry) => entry.isViewable);
      const nextIndex = firstVisible?.index;
      if (typeof nextIndex === "number") {
        setCurrentIndex(nextIndex);
      }
    }
  );
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60
  });

  if (!currentItem) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>Card not found.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.topChrome, { paddingTop: immersiveTopChromeInset(insets.top) + 10 }]}>
        <Pressable onPress={closeViewer} style={styles.chromeBtn} hitSlop={10}>
          <Ionicons name="close" size={20} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.positionText}>
          {currentIndex + 1} of {orderedCards.length}
        </Text>
        <Pressable
          onPress={() => {
            if (!currentItem.collectionItemId) return;
            router.push({
              pathname: "/collection/manage/[id]",
              params: { id: currentItem.collectionItemId }
            });
          }}
          style={styles.chromeBtn}
          hitSlop={10}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.textPrimary} />
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={orderedCards}
        style={styles.pager}
        horizontal
        pagingEnabled
        initialScrollIndex={initialIndex}
        keyExtractor={(item) => item.collectionItemId ?? item.id}
        onViewableItemsChanged={onViewableItemsChanged.current}
        viewabilityConfig={viewabilityConfig.current}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index
        })}
        renderItem={({ item }) => {
          const itemKey = item.collectionItemId ?? item.id;
          return (
            <View style={{ width, height }}>
              <ResultDetails
                card={item}
                sourceScanId={item.sourceScanId}
                detailBackHref={`/collection/view/${itemKey}`}
                hideCloseButton
                topSpacerHeight={overlayChromeSpacerHeight(insets.top, 56)}
                onEditResult={() => {
                  if (!item.collectionItemId) return;
                  router.push({
                    pathname: "/collection/manage/[id]",
                    params: { id: item.collectionItemId }
                  });
                }}
                onReportIncorrect={confirmRemove}
                isReporting={removingId === item.collectionItemId}
              />
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    ...typography.H2,
    fontFamily: "Inter-SemiBold"
  },
  pager: {
    flex: 1
  },
  topChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: layout.pagePadding
  },
  chromeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center"
  },
  positionText: {
    ...typography.Caption,
    color: "#6E7686",
    fontFamily: "Inter-Medium",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  }
});
