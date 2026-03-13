import { useMemo } from "react";

export type RarityTier = "Common" | "Notable" | "Rare" | "Elite" | "Grail";

export type RarityVisualConfig = {
  interpretation: string;
  accentColor: string;
  rarityTint: string;
  rarityBorderColor: string;
  rarityGlowColor: string;
  ladderActiveColor: string;
  auraColor: string;
  auraBaseOpacity: number;
  auraPulseOpacity: number;
  revealDelayMs: number;
  revealPulseDurationMs: number;
};

const RARITY_VISUALS: Record<RarityTier, RarityVisualConfig> = {
  Common: {
    interpretation: "Standard collector card",
    accentColor: "#495462",
    rarityTint: "#F7F8FA",
    rarityBorderColor: "#D5DBE2",
    rarityGlowColor: "rgba(86,100,121,0.18)",
    ladderActiveColor: "#657181",
    auraColor: "#5B6470",
    auraBaseOpacity: 0,
    auraPulseOpacity: 0,
    revealDelayMs: 620,
    revealPulseDurationMs: 400
  },
  Notable: {
    interpretation: "Strong collector interest",
    accentColor: "#284E82",
    rarityTint: "#F4F8FE",
    rarityBorderColor: "#C3D4EE",
    rarityGlowColor: "rgba(70,108,170,0.2)",
    ladderActiveColor: "#3E669E",
    auraColor: "#5A82C1",
    auraBaseOpacity: 0.09,
    auraPulseOpacity: 0.04,
    revealDelayMs: 620,
    revealPulseDurationMs: 400
  },
  Rare: {
    interpretation: "Premium collector pull",
    accentColor: "#4E3289",
    rarityTint: "#F2EFFB",
    rarityBorderColor: "#CDBFEA",
    rarityGlowColor: "rgba(82,58,138,0.22)",
    ladderActiveColor: "#5E3D9E",
    auraColor: "#694EAD",
    auraBaseOpacity: 0.14,
    auraPulseOpacity: 0.05,
    revealDelayMs: 620,
    revealPulseDurationMs: 400
  },
  Elite: {
    interpretation: "Highly desirable card",
    accentColor: "#7E5410",
    rarityTint: "#FBF7EE",
    rarityBorderColor: "#DFC894",
    rarityGlowColor: "rgba(151,111,32,0.22)",
    ladderActiveColor: "#976821",
    auraColor: "#B8862F",
    auraBaseOpacity: 0.16,
    auraPulseOpacity: 0.05,
    revealDelayMs: 620,
    revealPulseDurationMs: 400
  },
  Grail: {
    interpretation: "Signature collector-tier card",
    accentColor: "#874611",
    rarityTint: "#FBF2EA",
    rarityBorderColor: "#DFB894",
    rarityGlowColor: "rgba(149,74,24,0.24)",
    ladderActiveColor: "#A7571E",
    auraColor: "#B75A29",
    auraBaseOpacity: 0.2,
    auraPulseOpacity: 0.06,
    revealDelayMs: 620,
    revealPulseDurationMs: 400
  }
};

export function useRarityVisuals(rarityTier?: RarityTier | null): RarityVisualConfig {
  return useMemo(() => {
    if (!rarityTier) return RARITY_VISUALS.Common;
    return RARITY_VISUALS[rarityTier] ?? RARITY_VISUALS.Common;
  }, [rarityTier]);
}
