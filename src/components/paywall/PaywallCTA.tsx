import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { PaywallPlanViewModel } from "@/types";
import { colors, typography } from "@/theme/tokens";

function ctaTitle(plan: PaywallPlanViewModel | null): string {
  if (!plan) return "Continue";
  return `Continue with ${plan.title}`;
}

export function PaywallCTA({
  selectedPlan,
  busy,
  statusText,
  onPurchase,
  tone = "dark",
  compact = false
}: {
  selectedPlan: PaywallPlanViewModel | null;
  busy: boolean;
  statusText?: string | null;
  onPurchase: () => void;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const ctaStyle = tone === "light" ? { ...styles.cta, ...styles.ctaLight } : styles.cta;

  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null]}>
      <PrimaryButton
        title={ctaTitle(selectedPlan)}
        onPress={onPurchase}
        disabled={!selectedPlan}
        pending={busy}
        pendingLabel="Processing..."
        style={compact ? { ...ctaStyle, ...styles.ctaCompact } : ctaStyle}
      />
      {statusText ? <Text style={[styles.status, tone === "light" ? styles.statusLight : null]}>{statusText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    gap: 7
  },
  wrapCompact: {
    marginTop: 10,
    gap: 4
  },
  cta: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 18,
    minHeight: 58,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18
  },
  ctaLight: {
    shadowOpacity: 0.12
  },
  ctaCompact: {
    minHeight: 52
  },
  status: {
    ...typography.bodySmall,
    color: "#DCE2EC",
    textAlign: "center"
  },
  statusLight: {
    color: "#596477"
  }
});
