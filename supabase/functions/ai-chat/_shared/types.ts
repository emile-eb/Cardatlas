// @ts-nocheck
export type ThreadType = "general" | "card";

export interface ChatRequestBody {
  mode: ThreadType;
  message: string;
  cardId?: string | null;
}

export interface ChatFailure {
  ok: false;
  error: {
    code:
      | "PREMIUM_REQUIRED"
      | "LIMIT_REACHED"
      | "EMPTY_MESSAGE"
      | "INVALID_CARD"
      | "DUPLICATE_MESSAGE"
      | "RATE_LIMITED"
      | "PROVIDER_ERROR"
      | "UNKNOWN";
    message: string;
    retryAfterSeconds?: number;
  };
}

export interface ChatSuccess {
  ok: true;
  threadId: string;
  threadType: ThreadType;
  cardId: string | null;
  model: string;
  usage: {
    aiMessagesUsed: number;
    aiMessagesLimit: number;
    aiMessagesRemaining: number;
  };
  assistant: {
    id: string;
    threadId: string;
    role: "assistant";
    content: string;
    metadata: Record<string, unknown> | null;
    model: string | null;
    errorState: string | null;
    createdAt: string;
  };
}

export type ChatResponse = ChatSuccess | ChatFailure;

export interface UserProfileContext {
  displayName: string | null;
  favoriteTeam: string | null;
  preferredSport: string | null;
  onboarding: {
    collectorType: string | null;
    sports: string[];
    goals: string[];
    collectionSize: string | null;
    cardTypes: string[];
    brands: string[];
  } | null;
}

export interface CardContext {
  id: string;
  sport: string | null;
  playerName: string;
  cardTitle: string;
  year: number | null;
  brand: string | null;
  setName: string | null;
  cardNumber: string | null;
  team: string | null;
  position: string | null;
  rarityLabel: string | null;
  description: string | null;
  playerInfo: Record<string, unknown> | null;
  latestConditionEstimate: string | null;
  referenceValue: number | null;
  currency: string | null;
  recentSales: Array<{
    source: string;
    price: number;
    currency: string;
    saleDate: string;
    condition: string | null;
    grade: string | null;
  }>;
  gradingOutlook: {
    recommendation: "Worth Grading" | "Only if condition is strong" | "Probably not worth grading";
    rationale: string;
    rawValue: number;
    psa9Value: number;
    psa10Value: number;
    potentialUpside: number;
  } | null;
}

export interface ChatContextBundle {
  profile: UserProfileContext;
  card: CardContext | null;
}

export interface ChatPromptPackage {
  systemPrompt: string;
  contextBlock: string;
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatProviderRequest {
  systemPrompt: string;
  contextBlock: string;
  history: ChatHistoryItem[];
  userMessage: string;
}

export interface ChatProviderResponse {
  model: string;
  text: string;
}

export interface CardAtlasChatProvider {
  providerName: string;
  generateResponse(input: ChatProviderRequest): Promise<ChatProviderResponse>;
}
