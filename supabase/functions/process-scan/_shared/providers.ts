// @ts-nocheck
import type { CardRecognitionProvider, RecognitionInput, StructuredCardIdentification } from "./types.ts";

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildMockResult(scanId: string): StructuredCardIdentification {
  const variants: StructuredCardIdentification[] = [
    {
      sport: "Baseball",
      playerName: "Shohei Ohtani",
      cardTitle: "2018 Topps Chrome Rookie",
      year: 2018,
      brand: "Topps",
      setName: "Chrome",
      cardNumber: "150",
      team: "Los Angeles Angels",
      position: "Pitcher/DH",
      rarityLabel: "Grail",
      conditionEstimate: "Mint 9",
      confidence: 0.93,
      description: "Flagship modern rookie profile with strong collector demand.",
      playerInfo: {
        era: "Modern",
        careerNote: "Two-way superstar and MVP-level performer."
      },
      referenceValue: 1210,
      gradedUpside: 1685,
      valueSource: "model_estimate",
      reviewNeeded: false,
      reviewReason: null
    },
    {
      sport: "Basketball",
      playerName: "LeBron James",
      cardTitle: "2003 Upper Deck Rookie",
      year: 2003,
      brand: "Upper Deck",
      setName: "Upper Deck",
      cardNumber: "221",
      team: "Cleveland Cavaliers",
      position: "Forward",
      rarityLabel: "Elite",
      conditionEstimate: "Near Mint-Mint",
      confidence: 0.88,
      description: "Core early-career issue from LeBron's rookie season.",
      playerInfo: {
        era: "Modern",
        careerNote: "All-time great with multi-era collectible demand."
      },
      referenceValue: 980,
      gradedUpside: 1320,
      valueSource: "model_estimate",
      reviewNeeded: false,
      reviewReason: null
    },
    {
      sport: "Football",
      playerName: "Tom Brady",
      cardTitle: "2000 Bowman Rookie",
      year: 2000,
      brand: "Bowman",
      setName: "Bowman Football",
      cardNumber: "236",
      team: "New England Patriots",
      position: "Quarterback",
      rarityLabel: "Rare",
      conditionEstimate: "Near Mint",
      confidence: 0.79,
      description: "High-demand Brady rookie with wide grading spread.",
      playerInfo: {
        era: "Modern",
        careerNote: "Seven-time champion and long-term hobby anchor."
      },
      referenceValue: 640,
      gradedUpside: 890,
      valueSource: "model_estimate",
      reviewNeeded: true,
      reviewReason: "Set variation uncertain"
    },
    {
      sport: "Soccer",
      playerName: "Lionel Messi",
      cardTitle: "2004 Mega Cracks Rookie",
      year: 2004,
      brand: "Panini",
      setName: "Mega Cracks",
      cardNumber: "71",
      team: "FC Barcelona",
      position: "Forward",
      rarityLabel: "Grail",
      conditionEstimate: "Mint",
      confidence: 0.9,
      description: "International grail rookie issue with premium demand.",
      playerInfo: {
        era: "Modern",
        careerNote: "Record-setting global icon and perennial hobby draw."
      },
      referenceValue: 1325,
      gradedUpside: 1810,
      valueSource: "model_estimate",
      reviewNeeded: false,
      reviewReason: null
    }
  ];

  const idx = hashCode(scanId) % variants.length;
  return variants[idx];
}

class CardSightProvider implements CardRecognitionProvider {
  providerName = "cardsight";

  async recognizeCard(input: RecognitionInput): Promise<unknown> {
    const endpoint = Deno.env.get("CARDSIGHT_API_URL");
    const apiKey = Deno.env.get("CARDSIGHT_API_KEY");

    // If live credentials are unavailable, stay behind the provider interface with deterministic mock output.
    if (!endpoint || !apiKey) {
      return buildMockResult(input.scanId);
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        frontImageUrl: input.frontImageUrl,
        backImageUrl: input.backImageUrl ?? null,
        mode: "structured_identification_v1"
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`CardSight provider error: ${response.status} ${body}`);
    }

    return await response.json();
  }
}

class GoogleGeminiProvider implements CardRecognitionProvider {
  providerName = "google_gemini";

  async recognizeCard(input: RecognitionInput): Promise<unknown> {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return buildMockResult(input.scanId);
    }

    const configuredModel = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.0-flash";

    const buildEndpoint = (model: string) =>
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const fetchAsInlinePart = async (url: string, fallbackMime = "image/jpeg") => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch image for Gemini: ${res.status}`);
      }
      const contentType = res.headers.get("content-type") || fallbackMime;
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return {
        inlineData: {
          mimeType: contentType,
          data: btoa(binary)
        }
      };
    };

    const imageParts: Array<Record<string, unknown>> = [];
    imageParts.push(await fetchAsInlinePart(input.frontImageUrl));
    if (input.backImageUrl) {
      imageParts.push(await fetchAsInlinePart(input.backImageUrl));
    }

    const jsonTemplate = {
      sport: "Baseball",
      playerName: "Shohei Ohtani",
      cardTitle: "2018 Topps Chrome Rookie",
      year: 2018,
      brand: "Topps",
      setName: "Chrome",
      cardNumber: "150",
      team: "Los Angeles Angels",
      position: "Pitcher/DH",
      rarityLabel: "Grail",
      conditionEstimate: "Mint 9",
      confidence: 0.91,
      description: "One of the defining modern rookie cards...",
      playerInfo: {
        era: "Modern",
        careerNote: "Two-way superstar..."
      },
      referenceValue: 1210.0,
      gradedUpside: 1685.0,
      valueSource: "model_estimate",
      reviewNeeded: false,
      reviewReason: null
    };

    const prompt = [
      "You are identifying a sports trading card from provided card images.",
      "Return ONLY valid JSON. No markdown. No extra text.",
      "Use this exact schema and field names:",
      JSON.stringify(jsonTemplate),
      "Rules:",
      "- confidence is 0..1",
      "- year can be null if unknown",
      "- reviewNeeded true if uncertain, and include reviewReason",
      "- referenceValue should be numeric USD estimate",
      "- gradedUpside should be numeric USD estimate for graded potential (null if unknown)"
    ].join("\n");

    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, ...imageParts]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    let response = await fetch(buildEndpoint(configuredModel), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (response.status === 404) {
      const modelsRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
        { method: "GET" }
      );
      if (modelsRes.ok) {
        const modelsJson = await modelsRes.json();
        const candidate = (modelsJson?.models ?? []).find(
          (m: any) =>
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes("generateContent")
        );
        const fallbackName = candidate?.name?.replace(/^models\//, "");
        if (fallbackName) {
          response = await fetch(buildEndpoint(fallbackName), {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
          });
        }
      }
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Gemini provider error: ${response.status} ${body}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text || typeof text !== "string") {
      throw new Error("Gemini provider returned no text response.");
    }

    try {
      return JSON.parse(text);
    } catch {
      const cleaned = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      return JSON.parse(cleaned);
    }
  }
}

export function createRecognitionProvider(): CardRecognitionProvider {
  const provider = (Deno.env.get("CARD_RECOGNITION_PROVIDER") ?? "cardsight").toLowerCase();
  if (provider === "google_gemini") {
    return new GoogleGeminiProvider();
  }
  return new CardSightProvider();
}
