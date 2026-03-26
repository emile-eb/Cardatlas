import type { PaywallPlanViewModel } from "@/types";
import { PaywallPlanCard } from "@/components/paywall/PaywallPlanCard";
import { StyleSheet, View } from "react-native";

export function orderPlans(plans: PaywallPlanViewModel[]): PaywallPlanViewModel[] {
  const rank = (plan: PaywallPlanViewModel) => {
    if (plan.billingPeriod === "yearly") return 0;
    if (plan.billingPeriod === "monthly") return 1;
    if (plan.billingPeriod === "weekly") return 2;
    return 3;
  };

  return [...plans].sort((a, b) => rank(a) - rank(b));
}

export function PaywallPlanSelector({
  plans,
  selectedPackageId,
  onSelect,
  disabled,
  tone = "dark",
  compact = false
}: {
  plans: PaywallPlanViewModel[];
  selectedPackageId: string | null;
  onSelect: (packageId: string) => void;
  disabled?: boolean;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const ordered = orderPlans(plans);
  const useTwoUpLayout = compact && ordered.length <= 2;

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null, useTwoUpLayout ? styles.wrapGrid : null]}>
      {ordered.map((plan) => (
        <View key={plan.packageId} style={useTwoUpLayout ? styles.gridItem : null}>
          <PaywallPlanCard
            plan={plan}
            selected={selectedPackageId === plan.packageId}
            onPress={() => onSelect(plan.packageId)}
            disabled={disabled}
            tone={tone}
            compact={compact}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 12
  },
  wrapCompact: {
    gap: 10
  },
  wrapGrid: {
    flexDirection: "row",
    gap: 10
  },
  gridItem: {
    flex: 1
  }
});

