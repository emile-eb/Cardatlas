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

export interface ActiveMarketDebugTrace {
  requestId: string;
  enabled?: boolean;
  inspectRejected?: boolean;
  requestOrigin?: "panel" | "grading";
}

export interface ActiveMarketDebugSummary {
  requestId: string;
  cardId: string;
  requestOrigin: string;
  dominantRejectionReason: string | null;
  thresholds: {
    raw: { minIdentityPoints: number };
    psa9: { minIdentityPoints: number; requireExplicitGrade: boolean };
    psa10: { minIdentityPoints: number; requireExplicitGrade: boolean };
  };
  identity: {
    player_name: string;
    year: number | null;
    brand: string | null;
    set_name: string | null;
    card_number: string | null;
    team: string | null;
    sport: string | null;
  };
  queryPlan: Array<{
    key: string;
    query: string;
    targetSegment: "raw" | "psa9" | "psa10";
  }>;
  queryResults: Array<{
    key: string;
    returnedCount: number;
  }>;
  totalRetrievedBeforeDedupe: number;
  totalRetrievedAfterDedupe: number;
  acceptedCount: number;
  rejectedCount: number;
  rejectionReasonBuckets: Record<string, number>;
  topRejectedCandidates: Array<{
    title: string;
    score: number;
    rejectionReason: string;
    matchedSignals: string[];
    contradictionSignals: string[];
    queryKey: string;
    targetSegment: "raw" | "psa9" | "psa10";
    cardNumberStatus: "match" | "missing" | "ambiguous" | "conflict" | string;
    cardNumberReason: string | null;
    conflictingCardNumber: string | null;
  }>;
  finalReturnedCount: number;
}

export interface ActiveMarketDebugError {
  requestId: string | null;
  cardId: string | null;
  stage: string;
  message: string;
  stack: string | null;
  context?: Record<string, unknown> | null;
}

export interface ActiveListingsProviderResult {
  provider: "mock" | "ebay";
  items: RawActiveListing[];
  usedMock: boolean;
  debugSummary?: ActiveMarketDebugSummary;
  debugError?: ActiveMarketDebugError;
}
