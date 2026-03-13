import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { PaywallPlanViewModel } from "@/types";
import { colors, typography } from "@/theme/tokens";

function ctaTitle(plan: PaywallPlanViewModel | null): string {
  if (!plan) return "Continue";
  if (plan.hasTrial && plan.trialLabel) return "Start free trial";
  return `Continue with ${plan.title}`;
}

export function PaywallCTA({
  selectedPlan,
  busy,
  statusText,
  onPurchase,
  tone = "dark"
}: {
  selectedPlan: PaywallPlanViewModel | null;
  busy: boolean;
  statusText?: string | null;
  onPurchase: () => void;
  tone?: "dark" | "light";
}) {
  const helperText = selectedPlan?.hasTrial
    ? selectedPlan.trialLabel ?? "Free trial available"
    : selectedPlan
      ? `No free trial on the ${selectedPlan.title.toLowerCase()} plan.`
      : null;
  const ctaStyle = tone === "light" ? { ...styles.cta, ...styles.ctaLight } : styles.cta;

  return (
    <View style={styles.wrap}>
      <PrimaryButton
        title={busy ? "Processing..." : ctaTitle(selectedPlan)}
        onPress={onPurchase}
        disabled={busy || !selectedPlan}
        style={ctaStyle}
      />
      {helperText ? <Text style={[styles.helper, tone === "light" ? styles.helperLight : null]}>{helperText}</Text> : null}
      {statusText ? <Text style={[styles.status, tone === "light" ? styles.statusLight : null]}>{statusText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 18,
    gap: 7
  },
  cta: {
    backgroundColor: colors.accentPrimary,
    borderRadius: 12,
    minHeight: 56,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 16
  },
  ctaLight: {
    shadowOpacity: 0.16
  },
  status: {
    ...typography.bodySmall,
    color: "#DCE2EC",
    textAlign: "center"
  },
  statusLight: {
    color: "#3C4757"
  },
  helper: {
    ...typography.bodySmall,
    color: "#AEB8C9",
    textAlign: "center"
  },
  helperLight: {
    color: "#66707F"
  }
});
