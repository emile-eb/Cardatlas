import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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

  const refreshResult = async () => {
    if (!id) return;
    const next = await scanProcessingService.getProcessedScanResult(id);
    setResult(next);
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
  }
});
