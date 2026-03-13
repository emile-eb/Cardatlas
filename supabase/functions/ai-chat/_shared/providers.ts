// @ts-nocheck
import type { CardAtlasChatProvider, ChatProviderRequest, ChatProviderResponse } from "./types.ts";

function safeTrim(text: string, max = 2000) {
  return (text ?? "").trim().slice(0, max);
}

function buildMockReply(input: ChatProviderRequest): string {
  const question = safeTrim(input.userMessage, 300);
  const isCard = input.contextBlock.includes("CARD CONTEXT");

  if (isCard) {
    return [
      "Quick read: this card has real collector signal, but the edge depends on condition and liquidity.",
      "If corners/surface look clean, prioritize comps in the same condition tier before grading.",
      `Your ask was: \"${question}\". Start with sold comps, then decide hold vs flip based on spread.`
    ].join(" ");
  }

  return [
    "Collector take: focus your scans on cards with clear rookie significance, constrained supply, and active buyer demand.",
    `On your question \"${question}\", I would compare recent solds first, then map risk vs upside before making a move.`
  ].join(" ");
}

class GoogleGeminiChatProvider implements CardAtlasChatProvider {
  providerName = "google_gemini_chat";

  async generateResponse(input: ChatProviderRequest): Promise<ChatProviderResponse> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    const configuredModel = Deno.env.get("GEMINI_CHAT_MODEL") ?? "gemini-2.5-flash";

    if (!apiKey) {
      return {
        model: "mock-collector-chat",
        text: buildMockReply(input)
      };
    }

    const buildEndpoint = (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const contents: Array<Record<string, unknown>> = [];

    for (const item of input.history) {
      contents.push({
        role: item.role === "assistant" ? "model" : "user",
        parts: [{ text: item.content }]
      });
    }

    contents.push({
      role: "user",
      parts: [{ text: `${input.contextBlock}\n\nUser message:\n${input.userMessage}` }]
    });

    const body = {
      systemInstruction: {
        role: "system",
        parts: [{ text: input.systemPrompt }]
      },
      contents,
      generationConfig: {
        temperature: 0.35,
        topP: 0.9,
        maxOutputTokens: 700
      }
    };

    let activeModel = configuredModel;
    let response = await fetch(buildEndpoint(activeModel), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (response.status === 404) {
      const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
        method: "GET"
      });
      if (modelsRes.ok) {
        const modelsJson = await modelsRes.json();
        const models = (modelsJson?.models ?? []) as Array<Record<string, unknown>>;
        const supportsGenerate = models.filter(
          (m) =>
            Array.isArray(m.supportedGenerationMethods) &&
            (m.supportedGenerationMethods as string[]).includes("generateContent")
        );

        const preferredNames = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"];
        let fallbackName: string | null = null;
        for (const preferred of preferredNames) {
          const hit = supportsGenerate.find((m) => String(m.name ?? "").endsWith(`/${preferred}`));
          if (hit) {
            fallbackName = preferred;
            break;
          }
        }
        if (!fallbackName && supportsGenerate[0]?.name) {
          fallbackName = String(supportsGenerate[0].name).replace(/^models\//, "");
        }

        if (fallbackName) {
          activeModel = fallbackName;
          response = await fetch(buildEndpoint(activeModel), {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
          });
        }
      }
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini chat provider error: ${response.status} ${errText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Gemini chat provider returned an empty response.");
    }

    return {
      model: activeModel,
      text: text.trim()
    };
  }
}

export function createChatProvider(): CardAtlasChatProvider {
  return new GoogleGeminiChatProvider();
}
