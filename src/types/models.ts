export type RarityLevel = 1 | 2 | 3 | 4 | 5;

export type CardItem = {
  id: string;
  collectionItemId?: string;
  sport?: string;
  sourceScanId?: string;
  sourceCardId?: string;
  isFavorite?: boolean;
  notes?: string | null;
  addedAt?: string;
  isAutograph?: boolean;
  isMemorabilia?: boolean;
  isParallel?: boolean;
  parallelName?: string | null;
  serialNumber?: string | null;
  isGraded?: boolean;
  gradingCompany?: "PSA" | "BGS" | "SGC" | "CGC" | "Other" | string | null;
  grade?: string | null;
  attributesUpdatedAt?: string | null;
  baseReferenceValue?: number;
  adjustedValue?: number | null;
  valuationSource?: string | null;
  valuationUpdatedAt?: string | null;
  correctedCardId?: string | null;
  wasCorrected?: boolean;
  correctionSource?: string | null;
  correctionReason?: string | null;
  reportedIncorrect?: boolean;
  valuationSnapshotId?: string | null;
  scanStatus?: "completed" | "needs_review" | "failed";
  confidenceLabel?: "high" | "medium" | "low";
  reviewReason?: string | null;
  playerName: string;
  cardTitle: string;
  year: number;
  brand: string;
  set: string;
  cardNumber: string;
  team: string;
  position: string;
  referenceValue: number;
  gradeScore?: number | null;
  gradedUpside?: number;
  rarityLevel: RarityLevel;
  rarityLabel: "Common" | "Notable" | "Rare" | "Elite" | "Grail";
  condition: string;
  description: string;
  playerInfo: {
    era: string;
    careerNote: string;
  };
  imageFront: string;
  imageBack: string;
  dateScanned: string;
};

export type MarketNewsItem = {
  id: string;
  headline: string;
  source: string;
  timeAgo: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

export type ScanPhase = "front" | "back";
