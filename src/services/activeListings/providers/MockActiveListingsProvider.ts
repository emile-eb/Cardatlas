import type { ActiveListingsProvider } from "@/services/activeListings/providers/ActiveListingsProvider";
import type { ActiveListingsProviderResult, RawActiveListing } from "@/services/activeListings/types";
import type { UUID } from "@/types";

function seededValue(seed: string): number {
  return seed.split("").reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 1), 0);
}

function buildPriceOffsets(seed: number): number[] {
  const sets = [
    [-0.12, -0.05, 0.03, 0.11, 0.18],
    [-0.09, -0.03, 0.02, 0.08, 0.14],
    [-0.15, -0.07, 0.01, 0.09, 0.21],
    [-0.11, -0.01, 0.04, 0.13, 0.19]
  ];
  return sets[seed % sets.length];
}

function conditionAt(index: number): string {
  const values = ["Near Mint", "Ungraded", "PSA 9", "PSA 10", "Excellent"];
  return values[index % values.length];
}

function titleAt(index: number): string {
  const values = [
    "Prizm Silver Parallel",
    "Optic Holo Rookie",
    "Topps Chrome Refractor",
    "Select Concourse",
    "Base Rookie Card"
  ];
  return values[index % values.length];
}

function imageAt(index: number): string {
  const urls = [
    "https://images.unsplash.com/photo-1615655096345-61a54750068d?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=800&q=80"
  ];
  return urls[index % urls.length];
}

class MockActiveListingsProviderImpl implements ActiveListingsProvider {
  readonly providerId = "mock" as const;

  async getActiveListings(
    cardId: UUID,
    options?: { referenceValue?: number; maxItems?: number; debugTrace?: import("@/services/activeListings/types").ActiveMarketDebugTrace }
  ): Promise<ActiveListingsProviderResult> {
    const maxItems = Math.max(4, Math.min(options?.maxItems ?? 5, 6));
    const base = Number(options?.referenceValue ?? 0);
    const safeBase = Number.isFinite(base) && base > 0 ? base : 100;
    const seed = seededValue(cardId || "cardatlas");
    const offsets = buildPriceOffsets(seed);

    const items: RawActiveListing[] = offsets.slice(0, maxItems).map((offset, index) => {
      const itemTs = new Date(Date.now() - index * 5 * 60 * 60 * 1000).toISOString();
      return {
        id: `active-${cardId}-${index}`,
        source: "ebay",
        title: `${titleAt(index)} · ${conditionAt(index)}`,
        price: Number((safeBase * (1 + offset)).toFixed(2)),
        currency: "USD",
        itemWebUrl: "https://www.ebay.com",
        imageUrl: imageAt(index),
        itemOriginDate: itemTs,
        condition: conditionAt(index),
        marketplaceId: "EBAY_US",
        rawPayload: { mock: true, offset }
      };
    });

    return {
      provider: "mock",
      items,
      usedMock: true
    };
  }
}

export const mockActiveListingsProvider: ActiveListingsProvider = new MockActiveListingsProviderImpl();
