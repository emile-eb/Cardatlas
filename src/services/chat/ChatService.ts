import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { ChatSendRequest, ChatSendResponse } from "@/types/chat";

export interface ChatService {
  sendMessage(request: ChatSendRequest): Promise<ChatSendResponse>;
}

class ChatServiceImpl implements ChatService {
  async sendMessage(request: ChatSendRequest): Promise<ChatSendResponse> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase.functions.invoke("ai-chat", {
      body: request
    });

    if (error) {
      return {
        ok: false,
        error: {
          code: "UNKNOWN",
          message: error.message ?? "Failed to call AI chat backend."
        }
      };
    }

    return data as ChatSendResponse;
  }
}

export const chatService: ChatService = new ChatServiceImpl();
