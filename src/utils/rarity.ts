import type { CardItem } from "@/types/models";

export function rarityFromPrice(value: number): { rarityLabel: CardItem["rarityLabel"]; rarityLevel: 1 | 2 | 3 | 4 | 5 } {
  if (value >= 5000) return { rarityLabel: "Grail", rarityLevel: 5 };
  if (value >= 500) return { rarityLabel: "Elite", rarityLevel: 4 };
  if (value >= 100) return { rarityLabel: "Rare", rarityLevel: 3 };
  if (value >= 25) return { rarityLabel: "Notable", rarityLevel: 2 };
  return { rarityLabel: "Common", rarityLevel: 1 };
}
