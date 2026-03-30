import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/PrimaryButton";
import type { BillingPeriod, PaywallPlanViewModel } from "@/types";
import { colors, typography } from "@/theme/tokens";
import { InlineLoadingState } from "@/components/loading/InlineLoadingState";

function periodKey(plan: PaywallPlanViewModel): BillingPeriod {
  if (plan.billingPeriod === "yearly" || plan.billingPeriod === "monthly" || plan.billingPeriod === "weekly") {
    return plan.billingPeriod;
  }

  const text = `${plan.title} ${plan.billingLabel}`.toLowerCase();
  if (text.includes("year")) return "yearly";
  if (text.includes("month")) return "monthly";
  if (text.includes("week")) return "weekly";
  return "unknown";
}

function planName(plan: PaywallPlanViewModel): string {
  const period = periodKey(plan);
  if (period === "yearly") return "Yearly";
  if (period === "monthly") return "Monthly";
  if (period === "weekly") return "Weekly";
  return plan.title;
}

function planPeriodLabel(plan: PaywallPlanViewModel): string {
  const period = periodKey(plan);
  if (period === "yearly") return "/year";
  if (period === "monthly") return "/mo";
  if (period === "weekly") return "/wk";
  return plan.billingLabel;
}

function parsePriceAmount(priceLabel: string): number | null {
  const match = priceLabel.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function equivalentLine(plan: PaywallPlanViewModel): string | null {
  if (periodKey(plan) !== "yearly") return null;
  const amount = parsePriceAmount(plan.priceLabel);
  if (amount == null) return null;
  return `$${(amount / 52).toFixed(2)}/week equivalent`;
}

function primaryPriceLine(plan: PaywallPlanViewModel): string {
  if (periodKey(plan) === "yearly") {
    const equivalent = equivalentLine(plan);
    return equivalent ? equivalent.replace("/week equivalent", "") : plan.priceLabel;
  }
  return plan.priceLabel;
}

function secondaryPriceLine(plan: PaywallPlanViewModel): string | null {
  if (periodKey(plan) === "yearly") {
    return `${plan.priceLabel}/year`;
  }
  return equivalentLine(plan);
}

function ctaTitle(plan: PaywallPlanViewModel | null): string {
  if (!plan) return "Continue";
  if (!plan.hasTrial) return `Continue with ${planName(plan)}`;

  const label = `${plan.trialLabel ?? ""}`.toLowerCase();
  if (label.includes("3-day") || label.includes("3 day")) return "Start My 3-Day Free Trial";
  return "Start My Free Trial";
}

function billingClarification(plan: PaywallPlanViewModel | null): string | null {
  if (!plan) return null;
  const period = periodKey(plan);
  const periodText =
    period === "yearly" ? "year" : period === "monthly" ? "month" : period === "weekly" ? "week" : "period";
  const equivalent = equivalentLine(plan);

  if (plan.hasTrial) {
    return equivalent
      ? `${plan.trialLabel ?? "Free trial"}, then ${plan.priceLabel} per ${periodText} (${equivalent.replace(" equivalent", "")})`
      : `${plan.trialLabel ?? "Free trial"}, then ${plan.priceLabel} per ${periodText}`;
  }

  return equivalent
    ? `Billed ${plan.priceLabel} per ${periodText} (${equivalent.replace(" equivalent", "")})`
    : `Billed ${plan.priceLabel} per ${periodText}`;
}

function TrialTimeline({ hasTrial }: { hasTrial: boolean }) {
  const rows = hasTrial
    ? [
        {
          title: "Today",
          body: "Unlock unlimited scans, AI collector tools, and premium market intelligence.",
          tone: "active" as const
        },
        {
          title: "In 2 Days - Reminder",
          body: "We'll remind you that your trial is ending soon.",
          tone: "active" as const
        },
        {
          title: "In 3 Days - Billing Starts",
          body: "You'll be charged on the correct billing date unless you cancel anytime before.",
          tone: "neutral" as const
        }
      ]
    : [
        {
          title: "Today",
          body: "Unlock unlimited scans, AI collector tools, and premium market intelligence.",
          tone: "active" as const
        },
        {
          title: "Today - Billing Starts",
          body: "Your selected plan begins immediately and renews automatically until you cancel.",
          tone: "neutral" as const
        }
      ];

  return (
    <View style={styles.timelineWrap}>
      {rows.map((row, index) => (
        <View key={row.title} style={styles.timelineRow}>
          <View style={styles.timelineRail}>
            <View
              style={[
                styles.timelineDot,
                row.tone === "active" ? styles.timelineDotActive : styles.timelineDotNeutral,
                index < 2 ? styles.timelineDotToday : null,
                index === rows.length - 1 ? styles.timelineDotBilling : null
              ]}
            >
              <Ionicons
                name={index === 0 ? "sparkles" : hasTrial && index === 1 ? "notifications" : "diamond"}
                size={index === 0 ? 13 : hasTrial && index === 1 ? 19 : 17}
                color="#FFFFFF"
              />
            </View>
            {index < rows.length - 1 ? (
              <View style={styles.timelineLineWrap}>
                <View style={[styles.timelineLine, index === 0 ? styles.timelineLineTop : null]} />
              </View>
            ) : null}
          </View>

          <View style={styles.timelineCopy}>
            <Text style={styles.timelineTitle}>{row.title}</Text>
            <Text style={styles.timelineBody}>{row.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TrialToggle({
  enabled,
  value,
  onChange
}: {
  enabled: boolean;
  value: boolean;
  onChange?: (value: boolean) => void;
}) {
  if (!enabled || !onChange) return null;

  return (
    <View style={styles.toggleWrap}>
      <View style={styles.toggleTrack}>
        <Pressable
          onPress={() => onChange(true)}
          style={[styles.toggleOption, value ? styles.toggleOptionActive : null]}
        >
          <Text style={[styles.toggleLabel, value ? styles.toggleLabelActive : null]}>With Free Trial</Text>
        </Pressable>
        <Pressable
          onPress={() => onChange(false)}
          style={[styles.toggleOption, !value ? styles.toggleOptionActive : null]}
        >
          <Text style={[styles.toggleLabel, !value ? styles.toggleLabelActive : null]}>Without Trial</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PlanOption({
  plan,
  selected,
  onPress
}: {
  plan: PaywallPlanViewModel;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.planCard,
        selected && styles.planCardSelected,
        pressed && styles.planCardPressed
      ]}
    >
      <View style={styles.planTopRow}>
        <Text style={styles.planName}>{planName(plan)}</Text>
        {selected ? (
          <View style={styles.planCheck}>
            <Ionicons name="checkmark" size={11} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <Text style={styles.planPrice}>
        {primaryPriceLine(plan)}
        <Text style={styles.planPeriod}>
          {periodKey(plan) === "yearly" ? "/week" : ` ${planPeriodLabel(plan)}`}
        </Text>
      </Text>
      {secondaryPriceLine(plan) ? (
        <Text style={styles.planSupport}>{secondaryPriceLine(plan)}</Text>
      ) : (
        <View style={styles.planSupportSpacer} />
      )}
    </Pressable>
  );
}

export function OnboardingPaywallPlanSelector({
  loading,
  plans,
  selectedPackageId,
  onSelect,
  selectedPlan,
  trialToggleEnabled = false,
  wantsFreeTrial = true,
  onChangeTrialMode,
  busy,
  statusText,
  onPurchase
}: {
  loading: boolean;
  plans: PaywallPlanViewModel[];
  selectedPackageId: string | null;
  onSelect: (packageId: string) => void;
  selectedPlan: PaywallPlanViewModel | null;
  trialToggleEnabled?: boolean;
  wantsFreeTrial?: boolean;
  onChangeTrialMode?: (value: boolean) => void;
  busy: boolean;
  statusText?: string | null;
  onPurchase: () => void;
}) {
  const insets = useSafeAreaInsets();
  const yearlyPlan = plans.find((plan) => periodKey(plan) === "yearly") ?? null;
  const monthlyPlan = plans.find((plan) => periodKey(plan) === "monthly") ?? null;
  const visiblePlans = [yearlyPlan, monthlyPlan].filter(Boolean) as PaywallPlanViewModel[];

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 14) }]}>
      <TrialToggle enabled={trialToggleEnabled} value={wantsFreeTrial} onChange={onChangeTrialMode} />
      <TrialTimeline hasTrial={Boolean(selectedPlan?.hasTrial)} />

      <View style={styles.planSection}>
        {loading ? (
          <InlineLoadingState
            title="Loading live plans"
            message="Preparing the current trial and pricing options."
            minHeight={172}
          />
        ) : plans.length === 0 ? (
          <InlineLoadingState
            title="Plans unavailable"
            message="We couldn't load pricing right now. Try again shortly."
            minHeight={172}
          />
        ) : (
          <View style={[styles.planGrid, visiblePlans.length === 1 ? styles.planGridSingle : null]}>
            {(visiblePlans.length > 0 ? visiblePlans : plans).map((plan) => (
              <PlanOption
                key={plan.packageId}
                plan={plan}
                selected={selectedPackageId === plan.packageId}
                onPress={() => onSelect(plan.packageId)}
              />
            ))}
          </View>
        )}
      </View>

      <PrimaryButton
        title={ctaTitle(selectedPlan)}
        onPress={onPurchase}
        disabled={!selectedPlan}
        pending={busy}
        pendingLabel="Processing..."
        style={styles.cta}
      />
      {statusText ? <Text style={styles.status}>{statusText}</Text> : null}

      <View style={styles.trustRow}>
        <Ionicons name="checkmark-circle" size={16} color="#171D27" />
        <Text style={styles.trustText}>{selectedPlan?.hasTrial ? "No payment due now" : "Cancel anytime"}</Text>
      </View>

      {billingClarification(selectedPlan) ? (
        <Text style={styles.billingText}>{billingClarification(selectedPlan)}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 10,
    paddingBottom: 8,
    flex: 1
  },
  toggleWrap: {
    marginTop: 14
  },
  toggleTrack: {
    flexDirection: "row",
    borderRadius: 16,
    padding: 4,
    backgroundColor: "#F2F4F7",
    borderWidth: 1,
    borderColor: "rgba(26,35,48,0.08)"
  },
  toggleOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  toggleOptionActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#10161F",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }
  },
  toggleLabel: {
    ...typography.BodyMedium,
    color: "#66707F",
    fontFamily: "Inter-SemiBold",
    textAlign: "center"
  },
  toggleLabelActive: {
    color: "#131A24"
  },
  timelineWrap: {
    gap: 4,
    marginTop: 24
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16
  },
  timelineRail: {
    width: 30,
    alignItems: "center"
  },
  timelineDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  timelineDotActive: {
    borderColor: "rgba(225,6,0,0.24)"
  },
  timelineDotToday: {
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary
  },
  timelineDotBilling: {
    backgroundColor: "#111111",
    borderColor: "#111111"
  },
  timelineDotNeutral: {
    borderColor: "rgba(26,35,48,0.12)"
  },
  timelineLineWrap: {
    flex: 1,
    alignItems: "center",
    minHeight: 58,
    paddingTop: 7
  },
  timelineLine: {
    width: 4,
    flex: 1,
    backgroundColor: "rgba(26,35,48,0.12)"
  },
  timelineLineTop: {
    backgroundColor: "rgba(225,6,0,0.20)"
  },
  timelineCopy: {
    flex: 1,
    paddingBottom: 18
  },
  timelineTitle: {
    ...typography.H3,
    color: "#131A24",
    fontFamily: "Inter-SemiBold",
    fontSize: 20,
    lineHeight: 24
  },
  timelineBody: {
    ...typography.BodyLarge,
    color: "#66707F",
    lineHeight: 23,
    marginTop: 6
  },
  planSection: {
    marginTop: 24,
    paddingTop: 24
  },
  planGrid: {
    flexDirection: "row",
    gap: 10
  },
  planGridSingle: {
    flexDirection: "column"
  },
  planCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(26,35,48,0.10)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 13,
    minHeight: 108
  },
  planCardSelected: {
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  planCardPressed: {
    opacity: 0.94
  },
  planTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  planName: {
    ...typography.BodyLarge,
    color: "#141B25",
    fontFamily: "Inter-SemiBold"
  },
  planCheck: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accentPrimary,
    alignItems: "center",
    justifyContent: "center"
  },
  planPrice: {
    ...typography.H1,
    color: "#121821",
    fontFamily: "Inter-Bold",
    fontSize: 24,
    lineHeight: 28,
    marginTop: 12
  },
  planPeriod: {
    ...typography.bodySmall,
    color: "#6D7685",
    fontFamily: "Inter-Medium"
  },
  planSupport: {
    ...typography.Caption,
    color: "#707988",
    marginTop: 8
  },
  planSupportSpacer: {
    height: 0
  },
  trustRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  trustText: {
    ...typography.BodyMedium,
    color: "#171D27",
    fontFamily: "Inter-Medium"
  },
  cta: {
    minHeight: 58,
    borderRadius: 18,
    marginTop: 18,
    backgroundColor: colors.accentPrimary,
    shadowColor: colors.accentPrimary,
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 }
  },
  status: {
    ...typography.bodySmall,
    color: "#4C5768",
    textAlign: "center",
    marginTop: 10
  },
  billingText: {
    ...typography.Caption,
    marginTop: 14,
    color: "#808999",
    textAlign: "center",
    lineHeight: 18
  }
});
