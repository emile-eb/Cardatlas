import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Panel } from "@/components/Panel";
import { compsService } from "@/services/comps/CompsService";
import type { CardSale, UUID } from "@/types";
import { colors, spacing, typography } from "@/theme/tokens";

type Props = {
  cardId?: UUID | null;
  referenceValue?: number;
  maxItems?: number;
  compact?: boolean;
};

function formatSaleDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function sourceLabel(source: string) {
  if (source === "demo_market") return "Demo Market";
  if (source === "ebay") return "eBay";
  return source;
}

function conditionBadgeLabel(sale: CardSale) {
  if (sale.grade?.trim()) return sale.grade.trim();
  if (sale.condition?.trim()) return sale.condition.trim();
  return "Unspecified";
}

function averagePrice(sales: CardSale[]): number {
  if (!sales.length) return 0;
  return sales.reduce((sum, sale) => sum + sale.price, 0) / sales.length;
}

export function RecentSalesPanel({ cardId, referenceValue, maxItems = 5, compact = false }: Props) {
  const [sales, setSales] = useState<CardSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusLabel, setStatusLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!cardId) {
        setSales([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const response = await compsService.getDisplayRecentSales(cardId, {
        referenceValue,
        maxItems
      });
      if (!active) return;

      setSales(response.sales.slice(0, maxItems));
      if (response.usedFallback) {
        setStatusLabel("Market Estimate");
      } else if (response.stale) {
        setStatusLabel("Refreshing");
      } else {
        setStatusLabel("Live");
      }
      setLoading(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, [cardId, referenceValue, maxItems]);

  const visibleRows = useMemo(() => sales.slice(0, maxItems), [sales, maxItems]);
  const lastSale = visibleRows[0];
  const avgSale = averagePrice(visibleRows);

  return (
    <Panel>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Market Comps</Text>
          <Text style={styles.title}>Recent Sales</Text>
        </View>
        {statusLabel ? (
          <View style={[styles.statusBadge, statusLabel === "Market Estimate" && styles.statusBadgeEstimate]}>
            <Text style={[styles.statusText, statusLabel === "Market Estimate" && styles.statusTextEstimate]}>{statusLabel}</Text>
          </View>
        ) : null}
      </View>

      {!loading && visibleRows.length ? (
        <View style={styles.summaryStrip}>
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Last Sale</Text>
            <Text style={styles.summaryValue}>{formatMoney(lastSale.price, lastSale.currency)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Avg Recent</Text>
            <Text style={styles.summaryValue}>{formatMoney(avgSale, lastSale.currency)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCell}>
            <Text style={styles.summaryLabel}>Sales</Text>
            <Text style={styles.summaryValue}>{visibleRows.length}</Text>
          </View>
        </View>
      ) : null}

      {loading ? <Text style={styles.loading}>Loading recent sales...</Text> : null}
      {!loading && !visibleRows.length ? <Text style={styles.empty}>No recent sales yet.</Text> : null}

      {!loading && visibleRows.length ? (
        <View style={styles.rows}>
          {visibleRows.map((sale, index) => {
            const hasUrl = Boolean(sale.url?.trim());
            return (
              <Pressable
                key={sale.id || `${sale.sourceListingId ?? "sale"}-${index}`}
                onPress={() => {
                  if (hasUrl && sale.url) {
                    void Linking.openURL(sale.url);
                  }
                }}
                disabled={!hasUrl}
                style={({ pressed }) => [
                  styles.row,
                  pressed && hasUrl && styles.rowPressed,
                  index === visibleRows.length - 1 && styles.rowLast
                ]}
              >
                <View style={styles.rowTop}>
                  <View style={styles.rowLeft}>
                    <Text style={styles.priceText}>{formatMoney(sale.price, sale.currency)}</Text>
                    <Text style={styles.metaText}>{sourceLabel(sale.source)} · {formatSaleDate(sale.saleDate)}</Text>
                  </View>
                  {!compact ? (
                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionText} numberOfLines={1}>{conditionBadgeLabel(sale)}</Text>
                    </View>
                  ) : null}
                </View>
                {hasUrl ? <Text style={styles.link}>Open listing</Text> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12
  },
  eyebrow: {
    ...typography.Caption,
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  title: {
    ...typography.H3,
    marginTop: 2,
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold"
  },
  statusBadge: {
    borderWidth: 1,
    borderColor: "#DADADA",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#FAFAFA"
  },
  statusBadgeEstimate: {
    borderColor: "#E9BDB8",
    backgroundColor: "#FFF6F5"
  },
  statusText: {
    ...typography.Caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  statusTextEstimate: {
    color: colors.accentPrimary
  },
  summaryStrip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: "#FCFCFC",
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 12
  },
  summaryCell: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2
  },
  summaryDivider: {
    width: 1,
    backgroundColor: colors.border
  },
  summaryLabel: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  summaryValue: {
    ...typography.BodyMedium,
    fontFamily: "Inter-SemiBold",
    color: colors.textPrimary
  },
  loading: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  empty: {
    ...typography.Caption,
    color: colors.textSecondary
  },
  rows: {
    gap: 8
  },
  row: {
    borderWidth: 1,
    borderColor: "#EAEAEA",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  rowPressed: {
    backgroundColor: "#FAFAFA"
  },
  rowLast: {
    marginBottom: 0
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  rowLeft: {
    flex: 1,
    minWidth: 0
  },
  priceText: {
    ...typography.H3,
    color: colors.textPrimary,
    fontFamily: "Inter-SemiBold"
  },
  metaText: {
    ...typography.Caption,
    color: colors.textSecondary,
    marginTop: 2
  },
  conditionBadge: {
    maxWidth: 120,
    borderWidth: 1,
    borderColor: "#E6E6E6",
    backgroundColor: "#F8F8F8",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4
  },
  conditionText: {
    ...typography.Caption,
    color: colors.textPrimary,
    fontFamily: "Inter-Medium"
  },
  link: {
    ...typography.Caption,
    color: colors.accentPrimary,
    marginTop: spacing.xs
  }
});
