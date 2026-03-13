import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PaywallPlanViewModel } from "@/types";
import { colors, typography } from "@/theme/tokens";

function periodKey(plan: PaywallPlanViewModel): "yearly" | "monthly" | "weekly" | "unknown" {
  if (plan.billingPeriod === "yearly" || plan.billingPeriod === "monthly" || plan.billingPeriod === "weekly") {
    return plan.billingPeriod;
  }
  const text = `${plan.title} ${plan.billingLabel}`.toLowerCase();
  if (text.includes("year")) return "yearly";
  if (text.includes("month")) return "monthly";
  if (text.includes("week")) return "weekly";
  return "unknown";
}

function periodTitle(plan: PaywallPlanViewModel): string {
  const key = periodKey(plan);
  if (key === "yearly") return "Yearly";
  if (key === "monthly") return "Monthly";
  if (key === "weekly") return "Weekly";
  return plan.title;
}

function periodUnit(plan: PaywallPlanViewModel): string {
  const key = periodKey(plan);
  if (key === "yearly") return "year";
  if (key === "monthly") return "month";
  if (key === "weekly") return "week";
  return "period";
}

function parsePriceAmount(priceLabel: string): number | null {
  const match = priceLabel.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function yearlyWeeklyEquivalent(plan: PaywallPlanViewModel): string | null {
  if (periodKey(plan) !== "yearly") return null;
  const amount = parsePriceAmount(plan.priceLabel);
  if (amount == null) return null;
  return `Only $${(amount / 52).toFixed(2)} / week`;
}

export function PaywallPlanCard({
  plan,
  selected,
  disabled,
  onPress,
  tone = "dark"
}: {
  plan: PaywallPlanViewModel;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  tone?: "dark" | "light";
}) {
  const pulse = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(pulse, {
      toValue: selected ? 1 : 0,
      duration: 170,
      useNativeDriver: true
    }).start();
  }, [pulse, selected]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] });
  const borderOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          styles.card,
          tone === "light" ? styles.cardLight : null,
          selected && styles.cardSelected,
          selected && tone === "light" ? styles.cardSelectedLight : null,
          pressed && !disabled && styles.cardPressed,
          disabled && styles.cardDisabled
        ]}
      >
        <Animated.View
          style={[styles.selectedStroke, tone === "light" ? styles.selectedStrokeLight : null, { opacity: borderOpacity }]}
          pointerEvents="none"
        />

        <View style={styles.left}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, tone === "light" ? styles.titleLight : null]}>{periodTitle(plan)}</Text>
            {(periodKey(plan) === "yearly" || plan.isRecommended) ? (
              <View style={[styles.badge, tone === "light" ? styles.badgeLight : null]}>
                <Text style={[styles.badgeText, tone === "light" ? styles.badgeTextLight : null]}>Best Value</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.price, tone === "light" ? styles.priceLight : null]}>
            {plan.priceLabel}
            <Text style={[styles.unit, tone === "light" ? styles.unitLight : null]}> / {periodUnit(plan)}</Text>
          </Text>
          {yearlyWeeklyEquivalent(plan) ? (
            <Text style={[styles.equiv, tone === "light" ? styles.equivLight : null]}>{yearlyWeeklyEquivalent(plan)}</Text>
          ) : null}
        </View>

        <View style={[styles.indicator, tone === "light" ? styles.indicatorLight : null, selected && styles.indicatorSelected]}>
          {selected ? <Ionicons name="checkmark" size={11} color="#FFFFFF" /> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 13,
    backgroundColor: "#121826",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden"
  },
  cardLight: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(26,35,48,0.08)",
    borderRadius: 16,
    minHeight: 70
  },
  cardSelected: {
    backgroundColor: "#192234",
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.17,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 14
  },
  cardSelectedLight: {
    backgroundColor: "#FFFFFF",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  selectedStroke: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    borderRadius: 13
  },
  selectedStrokeLight: {
    borderColor: "rgba(225,6,0,0.34)"
  },
  cardPressed: {
    opacity: 0.92
  },
  cardDisabled: {
    opacity: 0.55
  },
  left: {
    flex: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  title: {
    ...typography.BodyLarge,
    color: "#F5F8FE",
    fontFamily: "Inter-SemiBold"
  },
  titleLight: {
    color: "#18202B"
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(232,171,99,0.58)",
    backgroundColor: "rgba(232,171,99,0.14)",
    paddingHorizontal: 7,
    paddingVertical: 2
  },
  badgeLight: {
    backgroundColor: "rgba(225,6,0,0.06)",
    borderColor: "rgba(225,6,0,0.16)"
  },
  badgeText: {
    ...typography.Caption,
    color: "#F2C98E",
    fontFamily: "Inter-Medium"
  },
  badgeTextLight: {
    color: "#A0382E"
  },
  price: {
    ...typography.BodyLarge,
    marginTop: 2,
    color: "#F1F5FC",
    fontFamily: "Inter-SemiBold"
  },
  priceLight: {
    color: "#151D27"
  },
  unit: {
    ...typography.bodySmall,
    color: "#A9B3C5",
    fontFamily: "Inter-Regular"
  },
  unitLight: {
    color: "#687181"
  },
  equiv: {
    ...typography.Caption,
    marginTop: 2,
    color: "#B9C3D4",
    fontFamily: "Inter-Medium"
  },
  equivLight: {
    color: "#606979"
  },
  indicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#5D677A",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  indicatorLight: {
    borderColor: "#C8CFD9",
    backgroundColor: "#FFFFFF"
  },
  indicatorSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.accentPrimary
  }
});
