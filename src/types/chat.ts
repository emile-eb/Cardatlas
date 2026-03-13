import type { AIChatMessage, UUID } from "@/types";

export type ChatThreadType = "general" | "card";

export interface ChatSendRequest {
  mode: ChatThreadType;
  message: string;
  cardId?: UUID | null;
}

export interface ChatSendSuccess {
  ok: true;
  threadId: UUID;
  threadType: ChatThreadType;
  cardId: UUID | null;
  model: string;
  usage: {
    aiMessagesUsed: number;
    aiMessagesLimit: number;
    aiMessagesRemaining: number;
  };
  assistant: AIChatMessage;
}

export interface ChatSendFailure {
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

export type ChatSendResponse = ChatSendSuccess | ChatSendFailure;
