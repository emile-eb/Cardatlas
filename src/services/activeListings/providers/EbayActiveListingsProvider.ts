import type { ActiveListingsProvider } from "@/services/activeListings/providers/ActiveListingsProvider";
import type { ActiveListingsProviderResult } from "@/services/activeListings/types";
import type { UUID } from "@/types";

class EbayActiveListingsProviderImpl implements ActiveListingsProvider {
  readonly providerId = "ebay" as const;

  async getActiveListings(_cardId: UUID, _options?: { referenceValue?: number; maxItems?: number }): Promise<ActiveListingsProviderResult> {
    throw new Error("eBay active listings provider not configured yet.");
  }
}

export const ebayActiveListingsProvider: ActiveListingsProvider = new EbayActiveListingsProviderImpl();

