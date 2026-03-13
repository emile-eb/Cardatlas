import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { CardItem } from "@/types/models";
import { colors, spacing, typography } from "@/theme/tokens";
import { PriceText } from "./PriceText";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  item: CardItem;
  onPress?: () => void;
  onManage?: () => void;
};

function rarityVisuals(rarityLabel?: CardItem["rarityLabel"] | null) {
  const rarity = (rarityLabel ?? "Common").toLowerCase();

  if (rarity === "notable") {
    return {
      accent: "#5B6F95",
      dot: "#5B6F95",
      backgroundTint: "#FFFFFF",
      elevatedStyle: null
    };
  }

  if (rarity === "rare") {
    return {
      accent: "#5A4B88",
      dot: "#5A4B88",
      backgroundTint: "#FBFAFF",
      elevatedStyle: null
    };
  }

  if (rarity === "elite") {
    return {
      accent: "#A47A21",
      dot: "#A47A21",
      backgroundTint: "#FFFDF8",
      elevatedStyle: styles.rowElite
    };
  }

  if (rarity === "grail") {
    return {
      accent: "#8F5A29",
      dot: "#8F5A29",
      backgroundTint: "#FFF9F4",
      elevatedStyle: styles.rowGrail
    };
  }

  return {
    accent: "#D2D7E0",
    dot: "#7A818E",
    backgroundTint: "#FFFFFF",
    elevatedStyle: null
  };
}

export function CollectionCardItem({ item, onPress, onManage }: Props) {
  const visuals = rarityVisuals(item.rarityLabel);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: visuals.backgroundTint },
        visuals.elevatedStyle,
        pressed && styles.pressed
      ]}
      onPress={onPress}
    >
      <View style={[styles.rarityAccentBar, { backgroundColor: visuals.accent }]} />
      <View style={styles.rarityAccentInset} />
      <Image source={{ uri: item.imageFront }} style={styles.image} />
      <View style={styles.info}>
        <View style={styles.playerRow}>
          <Text numberOfLines={1} style={styles.player}>{item.playerName}</Text>
          {item.isFavorite ? <Ionicons name="star" size={14} color={colors.accentPrimary} /> : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>{item.year} {item.brand} {item.cardNumber}</Text>
        {(item.isAutograph || item.serialNumber?.trim() || (item.isParallel && item.parallelName?.trim()) || (item.isGraded && (item.gradingCompany || item.grade))) ? (
          <View style={styles.badgeRow}>
            {item.isAutograph ? <Text style={styles.badge}>AUTO</Text> : null}
            {item.serialNumber?.trim() ? <Text style={styles.badge}>{item.serialNumber.trim()}</Text> : null}
            {item.isParallel && item.parallelName?.trim() ? <Text style={styles.badge}>{item.parallelName.trim()}</Text> : null}
            {item.isGraded ? <Text style={styles.badge}>{`${item.gradingCompany ?? "Graded"} ${item.grade ?? ""}`.trim()}</Text> : null}
          </View>
        ) : null}
        <Text numberOfLines={1} style={styles.team}>{item.team}</Text>
        {item.notes?.trim() ? <Text numberOfLines={1} style={styles.notes}>Note: {item.notes}</Text> : null}
      </View>
      <View style={styles.right}>
        <PriceText value={item.referenceValue} style={styles.value} />
        {onManage ? (
          <Pressable
            hitSlop={8}
            onPress={(event) => {
              (event as any)?.stopPropagation?.();
              onManage();
            }}
            style={styles.manageBtn}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    position: "relative",
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#E5EAF0",
    borderRadius: 18,
    backgroundColor: colors.white,
    paddingLeft: 14,
    paddingRight: 12,
    paddingVertical: 9,
    gap: 14,
    alignItems: "center",
    overflow: "hidden"
  },
  rowElite: {
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2
  },
  rowGrail: {
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3
  },
  pressed: {
    opacity: 0.96
  },
  rarityAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4
  },
  rarityAccentInset: {
    position: "absolute",
    left: 4,
    top: 10,
    bottom: 10,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.36)"
  },
  image: {
    width: 58,
    height: 82,
    borderRadius: 11,
    backgroundColor: "#F5F7FA"
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 1
  },
  player: {
    ...typography.H3,
    fontSize: 16,
    lineHeight: 20,
    flex: 1
  },
  meta: {
    ...typography.Caption,
    color: "#66707F",
    fontFamily: "Inter-Medium"
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 3
  },
  badge: {
    ...typography.Caption,
    color: "#7a1411",
    backgroundColor: "#fff4f3",
    borderWidth: 1,
    borderColor: "#f2d0cd",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  team: {
    ...typography.BodyMedium,
    color: "#5E6878",
    marginTop: 1
  },
  notes: {
    ...typography.Caption,
    color: "#737C8B",
    marginTop: 1
  },
  right: {
    alignItems: "flex-end",
    justifyContent: "space-between",
    alignSelf: "stretch",
    minWidth: 78,
    paddingVertical: 2
  },
  manageBtn: {
    marginTop: 10,
    padding: 2,
    alignSelf: "flex-end"
  },
  value: {
    ...typography.H3,
    fontFamily: "Inter-Bold",
    color: colors.accentPrimary,
    fontVariant: ["tabular-nums"],
    lineHeight: 19
  }
});

