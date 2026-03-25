import type { ActiveListingsProviderResult, ActiveMarketDebugTrace } from "@/services/activeListings/types";
import type { UUID } from "@/types";

export interface ActiveListingsProvider {
  providerId: "mock" | "ebay";
  getActiveListings(
    cardId: UUID,
    options?: { referenceValue?: number; maxItems?: number; debugTrace?: ActiveMarketDebugTrace }
  ): Promise<ActiveListingsProviderResult>;
}
