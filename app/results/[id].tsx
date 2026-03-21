import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ResultDetails } from "@/components/ResultDetails";
import { scanProcessingService, type ProcessedScanResult } from "@/services/scans/ScanProcessingService";
import { scanCorrectionService } from "@/services/scans/ScanCorrectionService";
import { PrimaryButton } from "@/components/PrimaryButton";
import { colors, layout, typography } from "@/theme/tokens";
import { FullScreenLoading } from "@/components/loading/FullScreenLoading";

export default function ResultsScreen() {
  const { id, r } = useLocalSearchParams<{ id: string; r?: string }>();
  const [result, setResult] = useState<ProcessedScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [likelyMatches, setLikelyMatches] = useState<Array<{ id: string; label: string }>>([]);

  const refreshResult = async () => {
    if (!id) return;
    const next = await scanProcessingService.getProcessedScanResult(id);
    setResult(next);
    if (next?.status === "needs_review" || next?.confidenceLabel === "medium") {
      const matches = await scanCorrectionService.getLikelyMatches(id, 5);
      setLikelyMatches(
        matches.map((m) => ({
          id: m.id,
          label: `${m.playerName} ${m.year ?? ""} ${m.brand ?? ""} ${m.cardNumber ?? ""}`.replace(/\s+/g, " ").trim()
        }))
      );
    } else {
      setLikelyMatches([]);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const next = await scanProcessingService.getProcessedScanResult(id);
        if (!active) return;
        setResult(next);
        if (next?.status === "needs_review" || next?.confidenceLabel === "medium") {
          const matches = await scanCorrectionService.getLikelyMatches(id, 5);
          if (!active) return;
          setLikelyMatches(
            matches.map((m) => ({
              id: m.id,
              label: `${m.playerName} ${m.year ?? ""} ${m.brand ?? ""} ${m.cardNumber ?? ""}`.replace(/\s+/g, " ").trim()
            }))
          );
        } else {
          setLikelyMatches([]);
        }
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load scan result.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [id, r]);

  if (loading) {
    return (
      <FullScreenLoading
        title="Preparing card results"
        message="Loading the latest CardAtlas view for this scan."
        eyebrow="RESULTS"
        icon="card-outline"
      />
    );
  }

  if (error || !result) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? "Scan result not found."}</Text>
      </View>
    );
  }

  if (result.status === "failed") {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Scan failed</Text>
        <Text style={styles.label}>{result.errorMessage ?? "The scan could not be processed."}</Text>
        <PrimaryButton
          title="Retry Processing"
          pending={retrying}
          pendingLabel="Retrying..."
          onPress={async () => {
            if (!id) return;
            try {
              setRetrying(true);
              await scanProcessingService.retryScanProcessing(id);
              setLoading(true);
              const start = Date.now();
              while (Date.now() - start < 30000) {
                const status = await scanProcessingService.getScanStatus(id);
                if (status === "completed" || status === "needs_review" || status === "failed") {
                  break;
                }
                await new Promise((resolve) => setTimeout(resolve, 1200));
              }
              const refreshed = await scanProcessingService.getProcessedScanResult(id);
              setResult(refreshed);
            } finally {
              setLoading(false);
              setRetrying(false);
            }
          }}
        />
      </View>
    );
  }

  if (!result.card) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No processed card data available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {result.wasCorrected ? (
        <View style={styles.correctedBanner}>
          <Text style={styles.correctedText}>
            Result corrected {result.correctionSource ? `(${result.correctionSource.replace("_", " ")})` : "by you"}.
          </Text>
        </View>
      ) : null}
      {result.status === "needs_review" ? (
        <View style={styles.reviewBanner}>
          <Text style={styles.reviewText}>
            We are not fully confident about this scan yet. {result.reviewReason ?? "Please review and confirm the right card."}
          </Text>
          {likelyMatches.length ? (
            <View style={styles.matchWrap}>
              {likelyMatches.map((match) => (
                <Pressable
                  key={match.id}
                  style={styles.matchChip}
                  onPress={async () => {
                    if (!id) return;
                    await scanCorrectionService.applyCardSelection(id, match.id, "likely_match", "Selected likely match");
                    await refreshResult();
                  }}
                >
                  <Text style={styles.matchLabel} numberOfLines={1}>
                    {match.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.reviewCta}>
            <PrimaryButton
              title="Edit or Search Card"
              onPress={() => router.push(`/results/edit/${id}`)}
            />
          </View>
          <View style={styles.reviewCta}>
            <PrimaryButton
              title="Retry Processing"
              pending={retrying}
              pendingLabel="Reprocessing..."
              onPress={async () => {
                if (!id) return;
                try {
                  setRetrying(true);
                  await scanProcessingService.retryScanProcessing(id);
                  setLoading(true);
                  const start = Date.now();
                  while (Date.now() - start < 30000) {
                    const status = await scanProcessingService.getScanStatus(id);
                    if (status === "completed" || status === "needs_review" || status === "failed") {
                      break;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 1200));
                  }
                  const refreshed = await scanProcessingService.getProcessedScanResult(id);
                  setResult(refreshed);
                } finally {
                  setLoading(false);
                  setRetrying(false);
                }
              }}
            />
          </View>
        </View>
      ) : null}
      <ResultDetails
        card={result.card}
        sourceScanId={result.scanId}
        onEditResult={() => router.push(`/results/edit/${id}`)}
        onReportIncorrect={async () => {
          if (!id) return;
          try {
            setReporting(true);
            await scanCorrectionService.reportIncorrectResult(id, "User marked incorrect result");
            await refreshResult();
          } finally {
            setReporting(false);
          }
        }}
        isReporting={reporting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.pagePadding,
    gap: 12
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: "center"
  },
  error: {
    ...typography.bodyMedium,
    color: "#b3261e",
    textAlign: "center"
  },
  reviewBanner: {
    marginTop: 12,
    marginHorizontal: layout.pagePadding,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff5e8",
    borderWidth: 1,
    borderColor: "#f0d1a2"
  },
  correctedBanner: {
    marginTop: 12,
    marginHorizontal: layout.pagePadding,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#eef8f1",
    borderWidth: 1,
    borderColor: "#b9dcc4"
  },
  correctedText: {
    ...typography.bodySmall,
    color: "#1f6a34"
  },
  reviewText: {
    ...typography.bodySmall,
    color: "#8a4b08"
  },
  reviewCta: {
    marginTop: 10
  },
  matchWrap: {
    marginTop: 10,
    gap: 8
  },
  matchChip: {
    borderWidth: 1,
    borderColor: "#e8bf86",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fffdf9"
  },
  matchLabel: {
    ...typography.bodySmall,
    color: "#8a4b08"
  }
});
