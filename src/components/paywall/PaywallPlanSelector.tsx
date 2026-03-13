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
  tone = "dark"
}: {
  plans: PaywallPlanViewModel[];
  selectedPackageId: string | null;
  onSelect: (packageId: string) => void;
  disabled?: boolean;
  tone?: "dark" | "light";
}) {
  const ordered = orderPlans(plans);

  return (
    <View style={styles.wrap}>
      {ordered.map((plan) => (
        <PaywallPlanCard
          key={plan.packageId}
          plan={plan}
          selected={selectedPackageId === plan.packageId}
          onPress={() => onSelect(plan.packageId)}
          disabled={disabled}
          tone={tone}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8
  }
});

