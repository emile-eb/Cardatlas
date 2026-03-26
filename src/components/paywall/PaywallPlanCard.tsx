import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PaywallPlanViewModel } from "@/types";

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

export function PaywallPlanCard({
  plan,
  selected,
  disabled,
  onPress,
}: {
  plan: PaywallPlanViewModel;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const showBadge = periodKey(plan) === "yearly" || plan.isRecommended;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : null,
        pressed && !disabled ? styles.cardPressed : null,
        disabled ? styles.cardDisabled : null
      ]}
    >
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{periodTitle(plan)}</Text>
          {showBadge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Best Value</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.priceRow}>
          <Text style={styles.price}>{plan.priceLabel}</Text>
          <Text style={styles.unit}>/{periodUnit(plan)}</Text>
        </View>
      </View>

      <View style={[styles.radio, selected ? styles.radioSelected : null]}>
        {selected ? <Ionicons name="checkmark" size={12} color="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  cardSelected: {
    borderColor: "#111827",
    backgroundColor: "#F8FAFC"
  },
  cardPressed: {
    opacity: 0.9
  },
  cardDisabled: {
    opacity: 0.55
  },
  main: {
    flex: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap"
  },
  title: {
    color: "#111827",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: "Inter-SemiBold"
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#F2F4F7"
  },
  badgeText: {
    color: "#475467",
    fontSize: 10,
    lineHeight: 12,
    fontFamily: "Inter-SemiBold"
  },
  priceRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4
  },
  price: {
    color: "#111827",
    fontSize: 24,
    lineHeight: 28,
    fontFamily: "Inter-Bold"
  },
  unit: {
    color: "#667085",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter-Medium"
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12
  },
  radioSelected: {
    borderColor: "#111827",
    backgroundColor: "#111827"
  }
});
