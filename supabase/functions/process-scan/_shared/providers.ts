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
      gradeScore: 8.82,
      gradeScoreReason: "Strong visible centering and edges, with some uncertainty remaining around surface detail from the photo.",
      confidence: 0.93,
      description: "Flagship modern rookie profile with strong collector demand.",
      playerInfo: {
        era: "Modern",
        careerNote: "Two-way superstar and MVP-level performer."
      },
      referenceValue: 1210,
      gradedUpside: 1685,
      psa10Multiplier: 4.9,
      psa9Multiplier: 2.3,
      gradingReason: "Strong star power and rookie demand, but a gem-grade outcome still requires very clean surface and centering.",
      gradingRecommendation: "Only if condition is strong",
      gradingConfidence: "medium",
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
      gradeScore: 8.41,
      gradeScoreReason: "Clean overall eye appeal in the visible photo, but not enough to assume gem-level condition.",
      confidence: 0.88,
      description: "Core early-career issue from LeBron's rookie season.",
      playerInfo: {
        era: "Modern",
        careerNote: "All-time great with multi-era collectible demand."
      },
      referenceValue: 980,
      gradedUpside: 1320,
      psa10Multiplier: 3.8,
      psa9Multiplier: 1.9,
      gradingReason: "Demand is durable, but the long-term upside depends on presenting as a clean high-grade rookie.",
      gradingRecommendation: "Only if condition is strong",
      gradingConfidence: "medium",
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
      gradeScore: 7.64,
      gradeScoreReason: "Looks solid from the visible image, though the copy does not present as a top-end high-grade candidate.",
      confidence: 0.79,
      description: "High-demand Brady rookie with wide grading spread.",
      playerInfo: {
        era: "Modern",
        careerNote: "Seven-time champion and long-term hobby anchor."
      },
      referenceValue: 640,
      gradedUpside: 890,
      psa10Multiplier: 3.2,
      psa9Multiplier: 1.7,
      gradingReason: "High demand supports graded upside, but the card family has meaningful spread between strong and merely solid copies.",
      gradingRecommendation: "Only if condition is strong",
      gradingConfidence: "low",
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
      gradeScore: 8.9,
      gradeScoreReason: "Strong visible presentation, but the score stays conservative without full certainty on every surface.",
      confidence: 0.9,
      description: "International grail rookie issue with premium demand.",
      playerInfo: {
        era: "Modern",
        careerNote: "Record-setting global icon and perennial hobby draw."
      },
      referenceValue: 1325,
      gradedUpside: 1810,
      psa10Multiplier: 5.6,
      psa9Multiplier: 2.6,
      gradingReason: "Global demand and rookie prestige support grading, but only strong eye appeal should chase gem-level upside.",
      gradingRecommendation: "Worth Grading",
      gradingConfidence: "medium",
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

    const sanitizeMimeType = (value: string | null, fallbackMime = "image/jpeg") => {
      const raw = (value ?? "").split(";")[0]?.trim().toLowerCase();
      if (!raw) return fallbackMime;
      if (raw.startsWith("image/")) return raw;
      return fallbackMime;
    };

    const fetchAsInlinePart = async (label: "front" | "back", url: string, fallbackMime = "image/jpeg") => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch image for Gemini: ${res.status}`);
      }
      const contentType = sanitizeMimeType(res.headers.get("content-type"), fallbackMime);
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return {
        label,
        byteSize: bytes.length,
        contentType,
        inlineData: {
          mimeType: contentType,
          data: btoa(binary)
        }
      };
    };

    const imageParts: Array<Record<string, unknown>> = [];
    const frontPart = await fetchAsInlinePart("front", input.frontImageUrl);
    imageParts.push(frontPart);
    let backPart: Awaited<ReturnType<typeof fetchAsInlinePart>> | null = null;
    if (input.backImageUrl) {
      backPart = await fetchAsInlinePart("back", input.backImageUrl);
      imageParts.push(backPart);
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
      gradeScore: 8.82,
      gradeScoreReason: "Visible centering and edges look strong, but this remains a conservative CardAtlas visual estimate.",
      confidence: 0.91,
      description: "One of the defining modern rookie cards...",
      playerInfo: {
        era: "Modern",
        careerNote: "Two-way superstar..."
      },
      referenceValue: 1210.0,
      gradedUpside: 1685.0,
      psa10Multiplier: 4.9,
      psa9Multiplier: 2.3,
      gradingReason: "Estimate separate PSA 10 and PSA 9 multipliers conservatively from visible condition and collector demand.",
      gradingRecommendation: "Only if condition is strong",
      gradingConfidence: "medium",
      valueSource: "model_estimate",
      reviewNeeded: false,
      reviewReason: null
    };

    const prompt = [
      "You are an expert sports trading card identifier, collector market analyst, and grading-aware pricing assistant.",
      "",
      "Your job is to analyze the provided sports card images and return a best-effort structured assessment of the card.",
      "",
      "You are responsible for two things:",
      "1. identifying the card as accurately as possible",
      "2. estimating a realistic reference price based on the most likely exact card match and its apparent condition/state",
      "",
      "You should behave like a careful, experienced sports card expert, not a generic assistant.",
      "",
      "When identifying the card, pay close attention to:",
      "- sport",
      "- player name",
      "- year",
      "- brand",
      "- set",
      "- subset/insert",
      "- card number",
      "- rookie status",
      "- parallel/color/variant",
      "- autograph, patch, relic, memorabilia, serial numbering, or grading if visible",
      "- any visible condition clues",
      "",
      "When estimating price:",
      "- use the most likely exact card identity first",
      "- do not assume a rare parallel, autograph, or serial-numbered version unless there is clear visual evidence",
      "- if the exact version is uncertain, be conservative",
      "- separate identification confidence from pricing certainty",
      "- prefer realistic pricing over inflated pricing",
      "- if the card appears ungraded, estimate as an ungraded/raw card unless clear grading/slab evidence is visible",
      "- if condition appears weak, reflect that in the pricing logic",
      "- if condition appears strong, that can support stronger grading upside, but do not overstate it",
      "- estimate a CardAtlas Grade Score from 0.00 to 10.00 using only the visible condition in the submitted photo(s)",
      "- Grade Score is a CardAtlas visual estimate, not an official PSA, BGS, or SGC grade",
      "- use two decimal precision for gradeScore",
      "- do not assume condition on parts of the card that are not clearly visible",
      "",
      "You may be asked to support downstream grading logic, so your output should be grounded, conservative, and useful for decision-making.",
      "",
      "Return ONLY valid JSON.",
      "Do not include markdown.",
      "Do not include explanation outside the JSON.",
      "Do not include any extra text.",
      "",
      "Use this exact schema and field names:",
      JSON.stringify(jsonTemplate),
      "Rules:",
      "- confidence is 0..1",
      "- year can be null if unknown",
      "- reviewNeeded true if uncertain, and include reviewReason",
      "- referenceValue should be numeric USD estimate",
      "- gradedUpside should be numeric USD estimate for graded potential (null if unknown)",
      "- gradeScore should be numeric between 0.00 and 10.00",
      "- gradeScoreReason should briefly explain the visible condition read behind the score",
      "- psa10Multiplier and psa9Multiplier must be numeric multipliers against referenceValue",
      "- psa10Multiplier should usually be higher than psa9Multiplier",
      "- keep both multipliers realistic and conservative for decision support",
      "- gradingReason should briefly explain the gradeability read",
      "- gradingRecommendation should be one of: Worth Grading, Only if condition is strong, Probably not worth grading",
      "- gradingConfidence should be one of: high, medium, low"
    ].join("\n");

    const requestWithParts = async (parts: Array<Record<string, unknown>>) => {
      const requestBody = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, ...parts]
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

      return response;
    };

    let response = await requestWithParts(imageParts);

    if (!response.ok) {
      const combinedBody = await response.text();
      const diagnostics = [
        `combined_status=${response.status}`,
        `front_type=${frontPart.contentType}`,
        `front_bytes=${frontPart.byteSize}`
      ];

      if (backPart) {
        diagnostics.push(`back_type=${backPart.contentType}`);
        diagnostics.push(`back_bytes=${backPart.byteSize}`);
      }

      const isolatedResults: string[] = [];

      const frontOnlyResponse = await requestWithParts([frontPart]);
      if (!frontOnlyResponse.ok) {
        isolatedResults.push(`front_only=${frontOnlyResponse.status}`);
      } else {
        isolatedResults.push("front_only=ok");
      }

      if (backPart) {
        const backOnlyResponse = await requestWithParts([backPart]);
        if (!backOnlyResponse.ok) {
          isolatedResults.push(`back_only=${backOnlyResponse.status}`);
        } else {
          isolatedResults.push("back_only=ok");
        }
      }

      throw new Error(
        `Gemini provider error: ${response.status} ${combinedBody} | diagnostics: ${diagnostics.join(", ")} | isolation: ${isolatedResults.join(", ")}`
      );
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
