import { useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppState } from "@/state/AppState";
import { colors, layout, radius, spacing, typography } from "@/theme/tokens";
import { chatService } from "@/services/chat/ChatService";
import type { ChatMessage, CardItem } from "@/types/models";
import type { ChatThreadType } from "@/types/chat";
import { analyticsService } from "@/services/analytics/AnalyticsService";
import { ANALYTICS_EVENTS } from "@/constants/analyticsEvents";

const CARD_PROMPTS = [
  "Should I grade this card?",
  "Should I hold or sell this card?",
  "Why is this card valued this way?",
  "What should I know before selling it?"
];

const GENERAL_PROMPTS = [
  "Which cards in my collection stand out most?",
  "Which cards might be worth grading?",
  "What is strongest in my collection right now?",
  "What patterns do you see in my collection?"
];

function formatPrice(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "N/A";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function titleForCard(card: CardItem | null) {
  if (!card) return "Card-specific collector guidance";
  return `${card.playerName} ${card.year} ${card.brand}`;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scanResultsById, history, cards, enterAiOrPaywall, presentPaywall } = useAppState();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [limitText, setLimitText] = useState<string | null>(null);

  const isGeneral = id === "general";
  const mode: ChatThreadType = isGeneral ? "general" : "card";
  const card =
    !isGeneral && id
      ? scanResultsById[id] ?? history.find((x) => x.id === id || x.sourceCardId === id) ?? cards.find((x) => x.id === id)
      : null;

  const totalCollectionValue = useMemo(
    () => cards.reduce((sum, item) => sum + (Number.isFinite(item.referenceValue) ? item.referenceValue : 0), 0),
    [cards]
  );
  const favoriteCount = useMemo(() => cards.filter((item) => item.isFavorite).length, [cards]);

  const title = "Collector AI";
  const subtitle = isGeneral ? "Portfolio-aware collector guidance" : "Card-aware collector guidance";
  const contextTitle = isGeneral ? "Collection intelligence" : titleForCard(card);
  const starterPrompts = isGeneral ? GENERAL_PROMPTS : CARD_PROMPTS;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/home");
  };

  const sendMessage = async (messageText: string) => {
    const text = messageText.trim();
    if (!text || sending) return;
    setErrorText(null);
    setLimitText(null);

    const allowed = enterAiOrPaywall(!isGeneral ? (card?.sourceCardId ?? card?.id ?? id) : undefined);
    if (!allowed) return;

    const nextUserMessage: ChatMessage = {
      id: `${Date.now()}-u`,
      role: "user",
      text
    };
    setMessages((prev) => [...prev, nextUserMessage]);
    setInput("");
    setSending(true);
    analyticsService.track(ANALYTICS_EVENTS.aiMessageSent, {
      mode,
      hasCardContext: mode === "card"
    });

    try {
      const response = await chatService.sendMessage({
        mode,
        message: text,
        cardId: isGeneral ? null : (card?.sourceCardId ?? card?.id ?? id ?? null)
      });

      if (!response.ok) {
        analyticsService.track(ANALYTICS_EVENTS.aiMessageFailed, {
          mode,
          code: response.error.code
        });
        if (response.error.code === "PREMIUM_REQUIRED") {
          presentPaywall("ai_gate", !isGeneral && (card?.id ?? id) ? { cardId: card?.id ?? id } : undefined);
          return;
        }
        if (response.error.code === "LIMIT_REACHED") {
          setLimitText(response.error.message);
        } else {
          setErrorText(response.error.message);
        }
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: response.assistant.id,
          role: "assistant",
          text: response.assistant.content
        }
      ]);
    } catch (error) {
      analyticsService.track(ANALYTICS_EVENTS.aiMessageFailed, {
        mode,
        code: "UNKNOWN"
      });
      setErrorText(error instanceof Error ? error.message : "Collector AI is temporarily unavailable. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const canSend = useMemo(() => !sending && input.trim().length > 0, [sending, input]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xs, paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="chevron-back" size={18} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
      </View>

      <View style={styles.contextPanel}>
        <View style={styles.contextHeaderRow}>
          <Text style={styles.contextKicker}>{isGeneral ? "COLLECTION EXPERT" : "CARD CONTEXT"}</Text>
          <View style={styles.contextBadge}>
            <Ionicons name={isGeneral ? "sparkles-outline" : "diamond-outline"} size={12} color={colors.accentPrimary} />
            <Text style={styles.contextBadgeText}>{isGeneral ? "Collector utility" : "Card-aware"}</Text>
          </View>
        </View>

        {isGeneral ? (
          <View style={styles.generalSummary}>
            <Text style={styles.contextTitle}>{contextTitle}</Text>
            <Text style={styles.contextSupport}>Ask CardAtlas what deserves attention, what may be worth grading, and what stands out across your collection.</Text>
            <View style={styles.generalStatsRow}>
              <View style={styles.generalStat}>
                <Text style={styles.generalStatLabel}>Cards tracked</Text>
                <Text style={styles.generalStatValue}>{cards.length}</Text>
              </View>
              <View style={styles.generalStat}>
                <Text style={styles.generalStatLabel}>Portfolio value</Text>
                <Text style={styles.generalStatValue}>{formatPrice(totalCollectionValue)}</Text>
              </View>
              <View style={styles.generalStat}>
                <Text style={styles.generalStatLabel}>Favorites</Text>
                <Text style={styles.generalStatValue}>{favoriteCount}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cardSummary}>
            {card?.imageFront ? <Image source={{ uri: card.imageFront }} style={styles.cardThumb} /> : <View style={styles.cardThumbFallback}><Ionicons name="image-outline" size={18} color="#7A8190" /></View>}
            <View style={styles.cardSummaryText}>
              <Text style={styles.contextTitle} numberOfLines={2}>{contextTitle}</Text>
              <Text style={styles.cardSupport} numberOfLines={1}>
                {card ? `${card.team} • ${card.set}` : "Card-specific collector guidance"}
              </Text>
              <View style={styles.cardMetaRow}>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillLabel}>Ref Value</Text>
                  <Text style={styles.metaPillValue}>{formatPrice(card?.referenceValue)}</Text>
                </View>
                <View style={styles.metaPill}>
                  <Text style={styles.metaPillLabel}>Rarity</Text>
                  <Text style={styles.metaPillValue}>{card?.rarityLabel ?? "Unknown"}</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.chatArea}>
        <ScrollView
          style={styles.chat}
          contentContainerStyle={[styles.chatContent, messages.length === 0 && styles.chatContentEmpty]}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEyebrow}>{isGeneral ? "ASK WHAT TO DO NEXT" : "CARD-SCOPED GUIDANCE"}</Text>
              <Text style={styles.emptyTitle}>
                {isGeneral ? "Use AI like a collector decision engine." : "Get a grounded collector take on this card."}
              </Text>
              <Text style={styles.emptySub}>
                {isGeneral
                  ? "CardAtlas can help surface what matters in your collection, what may deserve grading, and where the strongest positions are."
                  : "Ask about grading, pricing, selling, or what stands out. CardAtlas already has the card context behind the conversation."}
              </Text>
              <View style={styles.promptGrid}>
                {starterPrompts.map((prompt) => (
                  <Pressable
                    key={prompt}
                    style={({ pressed }) => [styles.promptCard, pressed && styles.promptCardPressed]}
                    onPress={() => {
                      analyticsService.track(ANALYTICS_EVENTS.aiSuggestedPromptTapped, {
                        mode,
                        prompt
                      });
                      void sendMessage(prompt);
                    }}
                  >
                    <Text style={styles.promptCardText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <>
              {messages.map((message) => (
                <View key={message.id} style={[styles.messageWrap, message.role === "user" ? styles.messageWrapUser : styles.messageWrapAssistant]}>
                  <Text style={styles.messageRole}>{message.role === "user" ? "You" : "Collector AI"}</Text>
                  <View style={[styles.bubble, message.role === "user" ? styles.user : styles.assistant]}>
                    <Text style={[styles.bubbleText, message.role === "user" && styles.userText]}>{message.text}</Text>
                  </View>
                </View>
              ))}
              {sending ? (
                <View style={styles.messageWrapAssistant}>
                  <Text style={styles.messageRole}>Collector AI</Text>
                  <View style={[styles.bubble, styles.assistant, styles.thinkingBubble]}>
                    <View style={styles.thinkingDots}>
                      <View style={styles.thinkingDot} />
                      <View style={styles.thinkingDot} />
                      <View style={styles.thinkingDot} />
                    </View>
                    <Text style={styles.thinkingText}>Reviewing the market context</Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        {messages.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
            style={styles.suggestionsScroller}
          >
            {starterPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                style={styles.suggestionCard}
                onPress={() => {
                  analyticsService.track(ANALYTICS_EVENTS.aiSuggestedPromptTapped, {
                    mode,
                    prompt
                  });
                  setInput(prompt);
                }}
              >
                <Text numberOfLines={1} style={styles.suggestionText}>{prompt}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {limitText ? <Text style={styles.limitText}>{limitText}</Text> : null}
        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

        <View style={styles.inputShell}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={isGeneral ? "Ask about your collection, grading, or what deserves attention..." : "Ask what to do with this card..."}
            placeholderTextColor="#808896"
            style={styles.input}
            editable={!sending}
            multiline
            maxLength={400}
          />
          <Pressable onPress={() => void sendMessage(input)} disabled={!canSend} style={({ pressed }) => [styles.sendBtn, !canSend && styles.sendBtnDisabled, pressed && canSend && styles.sendBtnPressed]}>
            <Ionicons name="arrow-up" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.backgroundPrimary,
    paddingHorizontal: layout.pagePadding,
    gap: spacing.sm
  },
  headerRow: {
    minHeight: 40,
    justifyContent: "center",
    paddingTop: 4
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 4,
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 17,
    backgroundColor: "#FCFCFD"
  },
  headerTextWrap: {
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 44
  },
  title: {
    ...typography.h2,
    fontSize: 20,
    fontFamily: "Inter-SemiBold"
  },
  subtitle: {
    ...typography.bodySmall,
    color: "#6A7281",
    textAlign: "center"
  },
  contextPanel: {
    borderWidth: 1,
    borderColor: "#E7EAF0",
    backgroundColor: "#FCFCFD",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12
  },
  contextHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm
  },
  contextKicker: {
    ...typography.caption,
    color: "#7D8595",
    letterSpacing: 0.7,
    fontFamily: "Inter-Medium"
  },
  contextBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "#F1D7D4",
    backgroundColor: "#FFF7F6",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  contextBadgeText: {
    ...typography.caption,
    color: colors.accentPrimary,
    fontFamily: "Inter-Medium"
  },
  generalSummary: {
    gap: 10
  },
  contextTitle: {
    ...typography.h2,
    fontFamily: "Inter-SemiBold",
    lineHeight: 24
  },
  contextSupport: {
    ...typography.bodyMedium,
    color: "#555F70",
    lineHeight: 20
  },
  generalStatsRow: {
    flexDirection: "row",
    gap: 10
  },
  generalStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ECEFF4",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2
  },
  generalStatLabel: {
    ...typography.caption,
    color: "#7A8393"
  },
  generalStatValue: {
    ...typography.bodyMedium,
    fontFamily: "Inter-SemiBold",
    color: "#131A24"
  },
  cardSummary: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  cardThumb: {
    width: 60,
    height: 82,
    borderRadius: 12,
    backgroundColor: "#F1F3F6"
  },
  cardThumbFallback: {
    width: 60,
    height: 82,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E8EE",
    backgroundColor: "#F8F9FB",
    alignItems: "center",
    justifyContent: "center"
  },
  cardSummaryText: {
    flex: 1,
    gap: 4
  },
  cardSupport: {
    ...typography.bodySmall,
    color: "#687181"
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6
  },
  metaPill: {
    borderWidth: 1,
    borderColor: "#E9ECF2",
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 1
  },
  metaPillLabel: {
    ...typography.caption,
    color: "#7A8290"
  },
  metaPillValue: {
    ...typography.bodySmall,
    color: "#202734",
    fontFamily: "Inter-SemiBold"
  },
  chatArea: {
    flex: 1,
    minHeight: 220
  },
  chat: {
    flex: 1
  },
  chatContent: {
    gap: 16,
    paddingTop: 4,
    paddingBottom: spacing.lg
  },
  chatContentEmpty: {
    flexGrow: 1,
    justifyContent: "center"
  },
  emptyState: {
    gap: 10,
    paddingBottom: spacing.md
  },
  emptyEyebrow: {
    ...typography.caption,
    color: "#7C8594",
    letterSpacing: 0.7,
    fontFamily: "Inter-Medium"
  },
  emptyTitle: {
    ...typography.h1,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: "Inter-SemiBold",
    maxWidth: 320
  },
  emptySub: {
    ...typography.bodyMedium,
    color: "#566072",
    lineHeight: 20,
    maxWidth: 340
  },
  promptGrid: {
    gap: 10,
    marginTop: 8
  },
  promptCard: {
    borderWidth: 1,
    borderColor: "#E6EAF0",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  promptCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }]
  },
  promptCardText: {
    ...typography.bodyMedium,
    color: "#18202D",
    fontFamily: "Inter-Medium",
    lineHeight: 19
  },
  messageWrap: {
    maxWidth: "92%"
  },
  messageWrapAssistant: {
    alignSelf: "flex-start",
    maxWidth: "92%"
  },
  messageWrapUser: {
    alignSelf: "flex-end",
    maxWidth: "88%"
  },
  messageRole: {
    ...typography.caption,
    color: "#7A8292",
    fontFamily: "Inter-Medium",
    marginBottom: 6,
    marginHorizontal: 4
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18
  },
  assistant: {
    backgroundColor: "#F7F9FC",
    borderWidth: 1,
    borderColor: "#E8ECF3"
  },
  user: {
    backgroundColor: colors.accentPrimary
  },
  bubbleText: {
    ...typography.bodyMedium,
    color: "#18202D",
    lineHeight: 20
  },
  userText: {
    color: colors.white
  },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  thinkingDots: {
    flexDirection: "row",
    gap: 4
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A1A9B8"
  },
  thinkingText: {
    ...typography.bodySmall,
    color: "#5B6475",
    fontFamily: "Inter-Medium"
  },
  footer: {
    gap: 8,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: "#ECEFF4",
    backgroundColor: colors.backgroundPrimary
  },
  suggestionsScroller: {
    maxHeight: 48
  },
  suggestionsRow: {
    gap: 8,
    paddingRight: spacing.sm
  },
  suggestionCard: {
    borderWidth: 1,
    borderColor: "#E5E9EF",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "#FAFBFD",
    justifyContent: "center",
    alignSelf: "flex-start"
  },
  suggestionText: {
    ...typography.bodySmall,
    color: "#242D3B",
    fontFamily: "Inter-Medium"
  },
  limitText: {
    ...typography.bodySmall,
    color: "#8A4B08"
  },
  errorText: {
    ...typography.bodySmall,
    color: "#B3261E"
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E4E8EF",
    borderRadius: 18,
    backgroundColor: "#FAFBFD",
    paddingLeft: 14,
    paddingRight: 8,
    paddingTop: 10,
    paddingBottom: 8
  },
  input: {
    flex: 1,
    maxHeight: 100,
    ...typography.bodyMedium,
    color: "#151C28",
    textAlignVertical: "top",
    paddingTop: 2,
    paddingBottom: 2
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accentPrimary
  },
  sendBtnDisabled: {
    backgroundColor: "#D4D8E0"
  },
  sendBtnPressed: {
    opacity: 0.92
  }
});
