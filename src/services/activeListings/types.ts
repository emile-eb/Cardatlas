export interface RawActiveListing {
  id: string;
  source: string;
  title: string;
  price: number;
  currency: string;
  itemWebUrl?: string | null;
  imageUrl?: string | null;
  itemOriginDate: string;
  condition?: string | null;
  marketplaceId?: string | null;
  rawPayload?: Record<string, unknown> | null;
}

export interface ActiveListingsProviderResult {
  provider: "mock" | "ebay";
  items: RawActiveListing[];
  usedMock: boolean;
}

