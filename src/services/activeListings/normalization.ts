import type { ActiveListing } from "@/types";
import type { RawActiveListing } from "@/services/activeListings/types";

export function normalizeActiveListings(items: RawActiveListing[], usedMock: boolean): ActiveListing[] {
  return items.map((item) => ({
    id: item.id,
    source: item.source,
    sourceListingId: item.id,
    title: item.title,
    price: Number(item.price ?? 0),
    currency: item.currency || "USD",
    itemWebUrl: item.itemWebUrl ?? null,
    imageUrl: item.imageUrl ?? null,
    itemOriginDate: new Date(item.itemOriginDate).toISOString(),
    condition: item.condition ?? null,
    marketplaceId: item.marketplaceId ?? "EBAY_US",
    isMock: usedMock,
    rawPayload: item.rawPayload ?? null
  }));
}

