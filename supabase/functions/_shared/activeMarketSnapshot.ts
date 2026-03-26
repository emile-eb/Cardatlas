// @ts-nocheck
import {
  clean,
  getMarketplaceId,
  loadCardIdentity,
  retrieveAcceptedEbayMarketListings
} from "./liveMarketRetrieval.ts";

export { clean, loadCardIdentity };

function normalizeListingTitle(value: string | null | undefined): string {
  return clean(value)
    .toLowerCase()
    .replace(/[\-\/|\\]+/g, " ")
    .replace(/[^a-z0-9\s#]+/g, " ")
    .replace(/\bpsa\s*10\b/g, "psa 10")
    .replace(/\bpsa10\b/g, "psa 10")
    .replace(/\bpsa\s*9\b/g, "psa 9")
    .replace(/\bpsa9\b/g, "psa 9")
    .replace(/\bgem[\s\-]*mint[\s\-]*10\b/g, " gem mint 10 ")
    .replace(/\bmint[\s\-]*9\b/g, " mint 9 ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyTitle(title: string) {
  const normalizedTitle = normalizeListingTitle(title);

  const exclusionRules = [
    { pattern: /\bcase\s*break\b/, reason: "excluded_break_listing" },
    { pattern: /\bbreak\b/, reason: "excluded_break_listing" },
    { pattern: /\blots?\b/, reason: "excluded_lot_listing" },
    { pattern: /\bbundle\b/, reason: "excluded_bundle_listing" },
    { pattern: /\bpack\b/, reason: "excluded_pack_listing" },
    { pattern: /\bwax\b/, reason: "excluded_wax_listing" },
    { pattern: /\brepack\b/, reason: "excluded_repack_listing" },
    { pattern: /\breprint\b/, reason: "excluded_reprint_listing" },
    { pattern: /\bcustom\s+card\b/, reason: "excluded_custom_listing" },
    { pattern: /\bproxy\b/, reason: "excluded_proxy_listing" },
    { pattern: /\bdigital\b/, reason: "excluded_digital_listing" }
  ];

  for (const rule of exclusionRules) {
    if (rule.pattern.test(normalizedTitle)) {
      return { marketSegment: "excluded", classificationConfidence: "high", classificationReason: rule.reason };
    }
  }

  if (/\bpsa 10\b/.test(normalizedTitle)) {
    return { marketSegment: "psa10", classificationConfidence: "high", classificationReason: "matched_exact_psa10" };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bgem mint 10\b/.test(normalizedTitle)) {
    return { marketSegment: "psa10", classificationConfidence: "medium", classificationReason: "matched_psa_gem_mint_10" };
  }
  if (/\bpsa 9\b/.test(normalizedTitle)) {
    return { marketSegment: "psa9", classificationConfidence: "high", classificationReason: "matched_exact_psa9" };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bmint 9\b/.test(normalizedTitle)) {
    return { marketSegment: "psa9", classificationConfidence: "medium", classificationReason: "matched_psa_mint_9" };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bpsa (?!9\b|10\b)\d+(?:\.\d+)?\b/.test(normalizedTitle)) {
    return { marketSegment: "otherGraded", classificationConfidence: "high", classificationReason: "matched_psa_other_grade" };
  }
  if (/\b(bgs|beckett|sgc|cgc|csg)\b/.test(normalizedTitle)) {
    return { marketSegment: "otherGraded", classificationConfidence: "high", classificationReason: "matched_other_grading_company" };
  }
  if (/\b(graded|slabbed|encased|authentic)\b/.test(normalizedTitle)) {
    return { marketSegment: "otherGraded", classificationConfidence: "medium", classificationReason: "matched_generic_graded_term" };
  }

  return { marketSegment: "raw", classificationConfidence: "high", classificationReason: "no_grading_terms_found" };
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function filterSegmentListings(listings: any[], referenceValue?: number) {
  const prices = listings.map((listing) => listing.price).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) {
    return listings.map((listing) => ({ ...listing, wasOutlierFiltered: false, outlierFilterReason: null }));
  }

  if (listings.length >= 4) {
    const segmentMedian = median(prices);
    const lowerBound = segmentMedian * 0.5;
    const upperBound = segmentMedian * 2.0;
    return listings.map((listing) => {
      if (listing.price < lowerBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_below_segment_median_threshold" };
      if (listing.price > upperBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_above_segment_median_threshold" };
      return { ...listing, wasOutlierFiltered: false, outlierFilterReason: null };
    });
  }

  if (Number.isFinite(referenceValue) && Number(referenceValue) > 0) {
    const lowerBound = Number(referenceValue) * 0.4;
    const upperBound = Number(referenceValue) * 2.5;
    return listings.map((listing) => {
      if (listing.price < lowerBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_below_reference_threshold" };
      if (listing.price > upperBound) return { ...listing, wasOutlierFiltered: true, outlierFilterReason: "excluded_above_reference_threshold" };
      return { ...listing, wasOutlierFiltered: false, outlierFilterReason: null };
    });
  }

  return listings.map((listing) => ({ ...listing, wasOutlierFiltered: false, outlierFilterReason: null }));
}

function average(listings: any[]) {
  const prices = listings.map((listing) => Number(listing.price)).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) return null;
  return Number((prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2));
}

function buildSegments(listings: any[]) {
  return listings.reduce(
    (acc, listing) => {
      acc[listing.marketSegment].push(listing);
      return acc;
    },
    { raw: [], psa9: [], psa10: [], otherGraded: [], excluded: [] }
  );
}

export async function loadLatestReferenceValue(service: any, cardId: string) {
  const { data, error } = await service
    .from("valuation_snapshots")
    .select("reference_value,currency,fetched_at")
    .eq("card_id", cardId)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  return {
    referenceValue: Number.isFinite(Number(data?.reference_value)) ? Number(data.reference_value) : null,
    currency: clean(data?.currency) || "USD",
    fetchedAt: data?.fetched_at ?? null
  };
}

export async function fetchSegmentedActiveMarketSnapshot(identity: any, options: { limit?: number; referenceValue?: number | null } = {}) {
  const result = await retrieveAcceptedEbayMarketListings(identity, {
    limit: Math.min(Math.max(Number(options.limit ?? 12), 1), 24)
  });
  const marketplaceId = getMarketplaceId();

  const listings = result.items.map((item) => {
    const classification = classifyTitle(clean(item.title) || "eBay Listing");
    return {
      id: item.id,
      source: item.source,
      title: item.title,
      price: Number(item.price ?? 0),
      currency: item.currency || "USD",
      itemWebUrl: item.itemWebUrl ?? null,
      imageUrl: item.imageUrl ?? null,
      itemOriginDate: item.itemOriginDate ?? new Date().toISOString(),
      condition: item.condition ?? null,
      marketplaceId: item.marketplaceId ?? marketplaceId,
      rawPayload: item.rawPayload ?? null,
      marketSegment: classification.marketSegment,
      classificationConfidence: classification.classificationConfidence,
      classificationReason: classification.classificationReason,
      wasOutlierFiltered: false,
      outlierFilterReason: null
    };
  });

  const grouped = buildSegments(listings);
  const filteredSegments = {
    raw: filterSegmentListings(grouped.raw, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    psa9: filterSegmentListings(grouped.psa9, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    psa10: filterSegmentListings(grouped.psa10, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    otherGraded: filterSegmentListings(grouped.otherGraded, options.referenceValue).filter((listing) => !listing.wasOutlierFiltered),
    excluded: grouped.excluded
  };

  return {
    listings,
    segments: grouped,
    filteredSegments,
    marketSummary: {
      raw_avg_ask: average(filteredSegments.raw),
      psa9_avg_ask: average(filteredSegments.psa9),
      psa10_avg_ask: average(filteredSegments.psa10),
      listing_count_raw: filteredSegments.raw.length,
      listing_count_psa9: filteredSegments.psa9.length,
      listing_count_psa10: filteredSegments.psa10.length
    },
    queryCount: result.queries.length
  };
}
