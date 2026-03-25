import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { Panel } from "@/components/Panel";
import { scanCorrectionService, type CardSearchResult, type CardCorrectionFields } from "@/services/scans/ScanCorrectionService";
import { scanProcessingService } from "@/services/scans/ScanProcessingService";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { FullScreenLoading } from "@/components/loading/FullScreenLoading";

type FormState = {
  sport: string;
  playerName: string;
  year: string;
  brand: string;
  setName: string;
  cardNumber: string;
  team: string;
};

function toFormState(card: any | null): FormState {
  return {
    sport: card?.sport ?? "",
    playerName: card?.playerName ?? "",
    year: card?.year ? String(card.year) : "",
    brand: card?.brand ?? "",
    setName: card?.set ?? "",
    cardNumber: card?.cardNumber ?? "",
    team: card?.team ?? ""
  };
}

function mapToCorrectionFields(form: FormState): CardCorrectionFields {
  const yearValue = form.year.trim() ? Number(form.year.trim()) : null;
  return {
    sport: form.sport.trim() || null,
    playerName: form.playerName.trim() || null,
    year: Number.isFinite(yearValue as number) ? yearValue : null,
    brand: form.brand.trim() || null,
    setName: form.setName.trim() || null,
    cardNumber: form.cardNumber.trim() || null,
    team: form.team.trim() || null
  };
}

function formatSearchRow(result: CardSearchResult): string {
  return `${result.playerName} ${result.year ?? ""} ${result.brand ?? ""} ${result.setName ?? ""} #${result.cardNumber ?? ""}`
    .replace(/\s+/g, " ")
    .replace("# ", "#")
    .trim();
}

export default function EditResultScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [likelyMatches, setLikelyMatches] = useState<CardSearchResult[]>([]);
  const [form, setForm] = useState<FormState>(() => toFormState(null));

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [result, matches] = await Promise.all([
          scanProcessingService.getProcessedScanResult(id),
          scanCorrectionService.getLikelyMatches(id, 5)
        ]);
        if (!active) return;
        setForm(toFormState(result?.card ?? null));
        setLikelyMatches(matches);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load correction tools.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [id]);

  const applySelectedCard = async (cardId: string, source: "manual_search" | "likely_match", reason: string) => {
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      await scanCorrectionService.applyCardSelection(id, cardId, source, reason);
      router.replace(`/results/${id}?r=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply corrected card.");
    } finally {
      setSaving(false);
    }
  };

  const saveManualEdits = async () => {
    if (!id) return;
    try {
      setSaving(true);
      setError(null);
      await scanCorrectionService.applyManualEdits(id, mapToCorrectionFields(form), "Manual user correction");
      router.replace(`/results/${id}?r=${Date.now()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save manual edits.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FullScreenLoading
        title="Preparing correction tools"
        message="Loading the current scan and suggested card options."
        eyebrow="RESULT CORRECTION"
        icon="create-outline"
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace(`/results/${id}`);
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Edit Result</Text>
          <Text style={styles.subtitle}>Fix this scan quickly and keep your collection accurate.</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {likelyMatches.length ? (
          <Panel>
            <Text style={styles.panelTitle}>Suggested Cards</Text>
            <Text style={styles.helper}>Choose one if it matches this card.</Text>
            <View style={styles.chipsWrap}>
              {likelyMatches.slice(0, 5).map((match) => (
                <Pressable
                  key={match.id}
                  style={styles.matchChip}
                  disabled={saving}
                  onPress={() => applySelectedCard(match.id, "likely_match", "Selected likely match in correction flow")}
                >
                  <Text numberOfLines={1} style={styles.matchText}>
                    {formatSearchRow(match)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Panel>
        ) : null}

        <Panel>
          <Text style={styles.panelTitle}>Edit Fields Directly</Text>
          <Text style={styles.helper}>Update the fields and save to correct this scan.</Text>
          <View style={styles.formGrid}>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Player name</Text>
              <TextInput
                value={form.playerName}
                onChangeText={(value) => setForm((prev) => ({ ...prev, playerName: value }))}
                placeholder="Player name"
                style={styles.input}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Year</Text>
              <TextInput
                value={form.year}
                onChangeText={(value) => setForm((prev) => ({ ...prev, year: value.replace(/[^\d]/g, "") }))}
                placeholder="Year"
                keyboardType="numeric"
                style={styles.input}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Brand</Text>
              <TextInput
                value={form.brand}
                onChangeText={(value) => setForm((prev) => ({ ...prev, brand: value }))}
                placeholder="Brand"
                style={styles.input}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Set name</Text>
              <TextInput
                value={form.setName}
                onChangeText={(value) => setForm((prev) => ({ ...prev, setName: value }))}
                placeholder="Set name"
                style={styles.input}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Card number</Text>
              <TextInput
                value={form.cardNumber}
                onChangeText={(value) => setForm((prev) => ({ ...prev, cardNumber: value }))}
                placeholder="Card number"
                style={styles.input}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Team</Text>
              <TextInput
                value={form.team}
                onChangeText={(value) => setForm((prev) => ({ ...prev, team: value }))}
                placeholder="Team"
                style={styles.input}
                editable={!saving}
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Sport</Text>
              <TextInput
                value={form.sport}
                onChangeText={(value) => setForm((prev) => ({ ...prev, sport: value }))}
                placeholder="Sport"
                style={styles.input}
                editable={!saving}
              />
            </View>
          </View>
          <View style={styles.saveWrap}>
            <PrimaryButton
              title="Save Corrected Result"
              onPress={saveManualEdits}
              disabled={!form.playerName.trim()}
              pending={saving}
              pendingLabel="Saving..."
            />
          </View>
        </Panel>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary
  },
  header: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface
  },
  headerTextWrap: {
    flex: 1
  },
  title: {
    ...typography.h2
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingBottom: spacing.xxxl,
    gap: spacing.md
  },
  panelTitle: {
    ...typography.bodyMedium,
    fontFamily: "Inter-SemiBold",
    marginBottom: 2
  },
  helper: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  chipsWrap: {
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  matchChip: {
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "#FAFBFD",
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm
  },
  matchText: {
    ...typography.bodySmall,
    color: "#243042"
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface
  },
  formGrid: {
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  saveWrap: {
    marginTop: spacing.sm
  },
  error: {
    ...typography.bodySmall,
    color: "#b3261e",
    textAlign: "center",
    marginTop: spacing.xs
  }
});
