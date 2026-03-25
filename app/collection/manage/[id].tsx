import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useAppState } from "@/state/AppState";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";
import { useAppPreferences } from "@/features/settings/AppPreferencesProvider";

export default function ManageCollectionItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { cards, updateCollectionItem, removeCollectionItem, enterAiOrPaywall } = useAppState();
  const { preferences } = useAppPreferences();
  const item = useMemo(() => cards.find((card) => card.collectionItemId === id), [cards, id]);

  const [notes, setNotes] = useState(item?.notes ?? "");
  const [isFavorite, setIsFavorite] = useState(Boolean(item?.isFavorite));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutograph, setIsAutograph] = useState(Boolean(item?.isAutograph));
  const [isMemorabilia, setIsMemorabilia] = useState(Boolean(item?.isMemorabilia));
  const [isParallel, setIsParallel] = useState(Boolean(item?.isParallel));
  const [parallelName, setParallelName] = useState(item?.parallelName ?? "");
  const [hasSerialNumber, setHasSerialNumber] = useState(Boolean(item?.serialNumber?.trim()));
  const [serialNumber, setSerialNumber] = useState(item?.serialNumber ?? "");
  const [isGraded, setIsGraded] = useState(Boolean(item?.isGraded));
  const [gradingCompany, setGradingCompany] = useState(item?.gradingCompany ?? "");
  const [grade, setGrade] = useState(item?.grade ?? "");

  if (!item || !id) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Collection item not found.</Text>
      </View>
    );
  }

  const normalizedInitialNotes = (item.notes ?? "").trim();
  const normalizedCurrentNotes = notes.trim();
  const normalizedParallel = parallelName.trim();
  const normalizedSerial = serialNumber.trim();
  const normalizedGrade = grade.trim();
  const normalizedCompany = gradingCompany.trim();
  const initialHasSerial = Boolean(item.serialNumber?.trim());
  const hasChanges =
    normalizedInitialNotes !== normalizedCurrentNotes ||
    Boolean(item.isFavorite) !== isFavorite ||
    Boolean(item.isAutograph) !== isAutograph ||
    Boolean(item.isMemorabilia) !== isMemorabilia ||
    Boolean(item.isParallel) !== isParallel ||
    (item.parallelName ?? "").trim() !== (isParallel ? normalizedParallel : "") ||
    initialHasSerial !== hasSerialNumber ||
    (item.serialNumber ?? "").trim() !== (hasSerialNumber ? normalizedSerial : "") ||
    Boolean(item.isGraded) !== isGraded ||
    (item.gradingCompany ?? "").trim() !== (isGraded ? normalizedCompany : "") ||
    (item.grade ?? "").trim() !== (isGraded ? normalizedGrade : "");
  const formattedValue = `$${item.referenceValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

  const save = async () => {
    try {
      setSaving(true);
      setError(null);
      await updateCollectionItem(id, {
        notes: normalizedCurrentNotes ? normalizedCurrentNotes : null,
        isFavorite,
        isAutograph,
        isMemorabilia,
        isParallel,
        parallelName: isParallel ? (normalizedParallel || null) : null,
        serialNumber: hasSerialNumber ? (normalizedSerial || null) : null,
        isGraded,
        gradingCompany: isGraded ? (normalizedCompany || null) : null,
        grade: isGraded ? (normalizedGrade || null) : null
      });
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update collection item.");
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = async () => {
    try {
      setDeleting(true);
      setError(null);
      await removeCollectionItem(id);
      router.replace("/(tabs)/collection");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove item.");
    } finally {
      setDeleting(false);
    }
  };

  const remove = async () => {
    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
      const confirmed = globalThis.confirm("Remove this card from your collection?");
      if (!confirmed) return;
      await confirmRemove();
      return;
    }

    Alert.alert("Remove card?", "This removes the card from your collection only.", [
      { text: "Cancel", style: "cancel" },
      {
        text: deleting ? "Removing..." : "Remove",
        style: "destructive",
        onPress: () => {
          void confirmRemove();
        }
      }
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
              return;
            }
            router.replace("/(tabs)/collection");
          }}
          style={styles.backBtn}
          hitSlop={10}
        >
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>Manage Card</Text>
          <Text style={styles.subtitle}>{item.playerName} • {item.year} {item.brand}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.previewSection}>
          {item.imageFront ? (
            <Image source={{ uri: item.imageFront }} style={styles.previewImage} />
          ) : (
            <View style={styles.previewImageFallback}>
              <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
            </View>
          )}
          <View style={styles.previewInfo}>
            <Text style={styles.previewPlayer} numberOfLines={1}>
              {item.playerName}
            </Text>
            <Text style={styles.previewMeta} numberOfLines={1}>
              {item.year} {item.brand}
            </Text>
            <Text style={styles.previewTeam} numberOfLines={1}>
              {item.team}
            </Text>
            <View style={styles.previewValueWrap}>
              <Text style={styles.previewValueLabel}>Collection Value</Text>
              <Text style={styles.previewValue}>{formattedValue}</Text>
            </View>
          </View>
        </View>

        {preferences.collectorAiEnabled ? (
          <View style={styles.aiEntrySection}>
            <Text style={styles.aiEntryKicker}>Collector Utility</Text>
            <Text style={styles.aiEntryTitle}>Ask Collector AI what to do with this card</Text>
            <Text style={styles.aiEntryCopy}>
              Get a card-aware take on grading, pricing, and whether this card deserves closer attention.
            </Text>
            <SecondaryButton
              title="Ask Collector AI"
              onPress={() => {
                const cardContextId = item.sourceCardId ?? item.id;
                analyticsService.track(ANALYTICS_EVENTS.askAiFromManageCard, {
                  cardId: cardContextId,
                  collectionItemId: item.collectionItemId ?? id
                });
                if (!enterAiOrPaywall(cardContextId)) return;
                router.push(`/chat/${cardContextId}`);
              }}
              style={styles.aiEntryButton}
            />
          </View>
        ) : null}

        <View style={styles.controlsSection}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.label}>Favorite</Text>
              <Text style={styles.helper}>Pin this card to your favorites filter</Text>
            </View>
            <Pressable
              onPress={() => setIsFavorite((prev) => !prev)}
              style={[styles.favoriteToggle, isFavorite && styles.favoriteToggleActive]}
              hitSlop={8}
            >
              <View style={[styles.favoriteKnob, isFavorite && styles.favoriteKnobActive]} />
            </Pressable>
          </View>

          <View style={styles.divider} />

          <Text style={styles.label}>Card Attributes</Text>

          <View style={styles.attributeRow}>
            <Text style={styles.attributeLabel}>Autograph</Text>
            <Pressable
              onPress={() => setIsAutograph((prev) => !prev)}
              style={[styles.favoriteToggle, isAutograph && styles.favoriteToggleActive]}
              hitSlop={8}
            >
              <View style={[styles.favoriteKnob, isAutograph && styles.favoriteKnobActive]} />
            </Pressable>
          </View>

          <View style={styles.attributeRow}>
            <Text style={styles.attributeLabel}>Memorabilia / Patch</Text>
            <Pressable
              onPress={() => setIsMemorabilia((prev) => !prev)}
              style={[styles.favoriteToggle, isMemorabilia && styles.favoriteToggleActive]}
              hitSlop={8}
            >
              <View style={[styles.favoriteKnob, isMemorabilia && styles.favoriteKnobActive]} />
            </Pressable>
          </View>

          <View style={styles.attributeRow}>
            <Text style={styles.attributeLabel}>Parallel / Variant</Text>
            <Pressable
              onPress={() => setIsParallel((prev) => !prev)}
              style={[styles.favoriteToggle, isParallel && styles.favoriteToggleActive]}
              hitSlop={8}
            >
              <View style={[styles.favoriteKnob, isParallel && styles.favoriteKnobActive]} />
            </Pressable>
          </View>
          {isParallel ? (
            <TextInput
              value={parallelName}
              onChangeText={setParallelName}
              placeholder="Parallel Name (e.g. Gold /10, Blue Refractor)"
              placeholderTextColor="#8A8A8A"
              style={styles.attributeInput}
              maxLength={120}
            />
          ) : null}

          <View style={styles.attributeRow}>
            <Text style={styles.attributeLabel}>Serial Numbered</Text>
            <Pressable
              onPress={() => setHasSerialNumber((prev) => !prev)}
              style={[styles.favoriteToggle, hasSerialNumber && styles.favoriteToggleActive]}
              hitSlop={8}
            >
              <View style={[styles.favoriteKnob, hasSerialNumber && styles.favoriteKnobActive]} />
            </Pressable>
          </View>
          {hasSerialNumber ? (
            <TextInput
              value={serialNumber}
              onChangeText={setSerialNumber}
              placeholder="Serial # (e.g. 10/99)"
              placeholderTextColor="#8A8A8A"
              style={styles.attributeInput}
              maxLength={60}
            />
          ) : null}

          <View style={styles.attributeRow}>
            <Text style={styles.attributeLabel}>Graded</Text>
            <Pressable
              onPress={() => setIsGraded((prev) => !prev)}
              style={[styles.favoriteToggle, isGraded && styles.favoriteToggleActive]}
              hitSlop={8}
            >
              <View style={[styles.favoriteKnob, isGraded && styles.favoriteKnobActive]} />
            </Pressable>
          </View>
          {isGraded ? (
            <>
              <View style={styles.companyChipWrap}>
                {["PSA", "BGS", "SGC", "CGC", "Other"].map((company) => (
                  <Pressable
                    key={company}
                    onPress={() => setGradingCompany(company)}
                    style={[styles.companyChip, gradingCompany === company && styles.companyChipActive]}
                  >
                    <Text style={[styles.companyChipText, gradingCompany === company && styles.companyChipTextActive]}>{company}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={grade}
                onChangeText={setGrade}
                placeholder="Grade (e.g. 10, 9.5, 8)"
                placeholderTextColor="#8A8A8A"
                style={styles.attributeInput}
                maxLength={20}
              />
            </>
          ) : null}

          <View style={styles.divider} />

          <Text style={styles.label}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add your collector notes... Example: graded PSA candidate, trade target, childhood pull"
            placeholderTextColor="#8A8A8A"
            multiline
            style={styles.notesInput}
            maxLength={500}
          />
        </View>

        <View style={styles.actionsSection}>
          <PrimaryButton
            title="Save Changes"
            onPress={save}
            disabled={deleting || !hasChanges}
            pending={saving}
            pendingLabel="Saving..."
          />

          <Pressable onPress={remove} disabled={saving || deleting} style={styles.deleteBtn}>
            <View style={styles.deleteContent}>
              {deleting ? <ActivityIndicator size="small" color="#b3261e" /> : null}
              <Text style={styles.deleteText}>{deleting ? "Removing..." : "Remove from Collection"}</Text>
            </View>
          </Pressable>
        </View>

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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.pagePadding
  },
  header: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
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
    ...typography.h2,
    fontFamily: "Inter-SemiBold"
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  content: {
    paddingHorizontal: layout.pagePadding,
    paddingTop: 8,
    paddingBottom: 60,
    gap: 24
  },
  previewSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  previewImage: {
    width: 96,
    height: 132,
    borderRadius: 12,
    backgroundColor: "#F3F3F3"
  },
  previewImageFallback: {
    width: 96,
    height: 132,
    borderRadius: 12,
    backgroundColor: "#F6F6F6",
    borderWidth: 1,
    borderColor: "#E7E7E7",
    alignItems: "center",
    justifyContent: "center"
  },
  previewInfo: {
    flex: 1,
    gap: 2
  },
  previewPlayer: {
    ...typography.h3,
    fontFamily: "Inter-SemiBold"
  },
  previewMeta: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  previewTeam: {
    ...typography.bodySmall,
    color: colors.textPrimary
  },
  previewValueWrap: {
    marginTop: 12,
    gap: 2
  },
  previewValueLabel: {
    ...typography.caption,
    color: colors.textSecondary
  },
  previewValue: {
    ...typography.h3,
    color: colors.accentPrimary,
    fontFamily: "Inter-SemiBold"
  },
  aiEntrySection: {
    borderWidth: 1,
    borderColor: "#E7EBF1",
    backgroundColor: "#FBFCFD",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6
  },
  aiEntryKicker: {
    ...typography.Caption,
    color: "#7B8392",
    letterSpacing: 0.6,
    fontFamily: "Inter-Medium"
  },
  aiEntryTitle: {
    ...typography.H3,
    fontFamily: "Inter-SemiBold"
  },
  aiEntryCopy: {
    ...typography.BodyMedium,
    color: "#536072",
    lineHeight: 19
  },
  aiEntryButton: {
    marginTop: 4
  },
  controlsSection: {
    gap: 14
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  divider: {
    height: 1,
    backgroundColor: "#EBEBEB"
  },
  attributeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  attributeLabel: {
    ...typography.bodySmall,
    color: colors.textPrimary
  },
  attributeInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...typography.bodyMedium
  },
  companyChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  companyChip: {
    borderWidth: 1,
    borderColor: "#EAEAEA",
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  companyChipActive: {
    backgroundColor: "#FFF4F3",
    borderColor: "#F2D0CD"
  },
  companyChipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontFamily: "Inter-Medium"
  },
  companyChipTextActive: {
    color: colors.accentPrimary
  },
  favoriteToggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#DDDDDD",
    backgroundColor: "#F4F4F4",
    padding: 3,
    justifyContent: "center"
  },
  favoriteToggleActive: {
    borderColor: "#F2D0CD",
    backgroundColor: "#FFF4F3"
  },
  favoriteKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8D8D8"
  },
  favoriteKnobActive: {
    transform: [{ translateX: 20 }],
    backgroundColor: colors.accentPrimary,
    borderColor: colors.accentPrimary
  },
  label: {
    ...typography.bodyMedium,
    fontFamily: "Inter-SemiBold"
  },
  helper: {
    ...typography.bodySmall,
    color: colors.textSecondary
  },
  notesInput: {
    minHeight: 132,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: "#FAFAFA",
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlignVertical: "top",
    ...typography.bodyMedium
  },
  actionsSection: {
    marginTop: 8,
    gap: 14
  },
  deleteBtn: {
    alignItems: "center",
    paddingVertical: 6
  },
  deleteContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  deleteText: {
    ...typography.bodySmall,
    color: "#b3261e",
    fontFamily: "Inter-Medium"
  },
  error: {
    ...typography.bodySmall,
    color: "#b3261e",
    textAlign: "center"
  }
});

