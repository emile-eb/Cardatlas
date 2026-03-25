import type { ActiveListing, ActiveListingsSegments, ActiveMarketClassificationConfidence, ActiveMarketSegment } from "@/types";
import type { CardItem } from "@/types/models";

type ListingClassification = {
  marketSegment: ActiveMarketSegment;
  classificationConfidence: ActiveMarketClassificationConfidence;
  classificationReason: string;
};

const EXCLUSION_RULES: Array<{ pattern: RegExp; reason: string }> = [
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

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeListingTitle(title: string): string {
  return collapseWhitespace(
    title
      .toLowerCase()
      .replace(/[|/\\]+/g, " ")
      .replace(/[-–—]+/g, " ")
      .replace(/[()[\],;:]+/g, " ")
      .replace(/psa[\s\-\/]*10\b/g, " psa 10 ")
      .replace(/psa[\s\-\/]*9\b/g, " psa 9 ")
      .replace(/gem[\s\-]*mint[\s\-]*10\b/g, " gem mint 10 ")
      .replace(/\bmint[\s\-]*9\b/g, " mint 9 ")
      .replace(/\s+#/g, " #")
  );
}

function classifyExcluded(normalizedTitle: string): ListingClassification | null {
  for (const rule of EXCLUSION_RULES) {
    if (rule.pattern.test(normalizedTitle)) {
      return {
        marketSegment: "excluded",
        classificationConfidence: "high",
        classificationReason: rule.reason
      };
    }
  }
  return null;
}

function classifyPsa10(normalizedTitle: string): ListingClassification | null {
  if (/\bpsa 10\b/.test(normalizedTitle)) {
    return {
      marketSegment: "psa10",
      classificationConfidence: "high",
      classificationReason: "matched_exact_psa10"
    };
  }
  if (/\bpsa\b/.test(normalizedTitle) && /\bgem mint 10\b/.test(normalizedTitle)) {
    return {
      marketSegment: "psa10",
      classificationConfidence: "medium",
      classificationReason: "matched_psa_gem_mint_10"
    };
  }
  return null;
}

function classifyPsa9(normalizedTitle: string): ListingClassification | null {
  if (/\bpsa 9\b/.test(normalizedTitle)) {
    return {
      marketSegment: "psa9",
      classificationConfidence: "high",
      classificationReason: "matched_exact_psa9"
    };
  }
  return null;
}

function classifyOtherGraded(normalizedTitle: string): ListingClassification | null {
  if (/\bpsa\b/.test(normalizedTitle) && /\bpsa (?!9\b|10\b)\d+(?:\.\d+)?\b/.test(normalizedTitle)) {
    return {
      marketSegment: "otherGraded",
      classificationConfidence: "high",
      classificationReason: "matched_psa_other_grade"
    };
  }

  if (/\b(bgs|beckett|sgc|cgc|csg)\b/.test(normalizedTitle)) {
    return {
      marketSegment: "otherGraded",
      classificationConfidence: "high",
      classificationReason: "matched_other_grading_company"
    };
  }

  if (/\b(graded|slabbed|encased|authentic)\b/.test(normalizedTitle)) {
    return {
      marketSegment: "otherGraded",
      classificationConfidence: "medium",
      classificationReason: "matched_generic_graded_term"
    };
  }

  return null;
}

export function classifyActiveListingTitle(title: string): ListingClassification {
  const normalizedTitle = normalizeListingTitle(title);

  return (
    classifyExcluded(normalizedTitle) ??
    classifyPsa10(normalizedTitle) ??
    classifyPsa9(normalizedTitle) ??
    classifyOtherGraded(normalizedTitle) ?? {
      marketSegment: "raw",
      classificationConfidence: "high",
      classificationReason: "no_grading_terms_found"
    }
  );
}

export function createEmptyActiveListingsSegments(): ActiveListingsSegments {
  return {
    raw: [],
    psa9: [],
    psa10: [],
    otherGraded: [],
    excluded: []
  };
}

export function groupActiveListingsBySegment(listings: ActiveListing[]): ActiveListingsSegments {
  return listings.reduce<ActiveListingsSegments>((groups, listing) => {
    groups[listing.marketSegment].push(listing);
    return groups;
  }, createEmptyActiveListingsSegments());
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function markOutlier(listing: ActiveListing, reason: string | null): ActiveListing {
  return {
    ...listing,
    wasOutlierFiltered: Boolean(reason),
    outlierFilterReason: reason
  };
}

function filterSegmentListings(
  listings: ActiveListing[],
  referenceValue?: number
): ActiveListing[] {
  const prices = listings.map((listing) => listing.price).filter((price) => Number.isFinite(price) && price > 0);
  if (!prices.length) {
    return listings.map((listing) => markOutlier(listing, null));
  }

  if (listings.length >= 4) {
    const segmentMedian = median(prices);
    const lowerBound = segmentMedian * 0.5;
    const upperBound = segmentMedian * 2.0;
    return listings.map((listing) => {
      if (listing.price < lowerBound) {
        return markOutlier(listing, "excluded_below_segment_median_threshold");
      }
      if (listing.price > upperBound) {
        return markOutlier(listing, "excluded_above_segment_median_threshold");
      }
      return markOutlier(listing, null);
    });
  }

  if (Number.isFinite(referenceValue) && Number(referenceValue) > 0) {
    const lowerBound = Number(referenceValue) * 0.4;
    const upperBound = Number(referenceValue) * 2.5;
    return listings.map((listing) => {
      if (listing.price < lowerBound) {
        return markOutlier(listing, "excluded_below_reference_threshold");
      }
      if (listing.price > upperBound) {
        return markOutlier(listing, "excluded_above_reference_threshold");
      }
      return markOutlier(listing, null);
    });
  }

  return listings.map((listing) => markOutlier(listing, null));
}

export function applyOutlierFilteringToListings(
  listings: ActiveListing[],
  referenceValue?: number
): ActiveListing[] {
  const grouped = groupActiveListingsBySegment(listings);
  const filtered = {
    raw: filterSegmentListings(grouped.raw, referenceValue),
    psa9: filterSegmentListings(grouped.psa9, referenceValue),
    psa10: filterSegmentListings(grouped.psa10, referenceValue),
    otherGraded: filterSegmentListings(grouped.otherGraded, referenceValue),
    excluded: grouped.excluded.map((listing) => markOutlier(listing, null))
  };

  return [
    ...filtered.raw,
    ...filtered.psa9,
    ...filtered.psa10,
    ...filtered.otherGraded,
    ...filtered.excluded
  ];
}

export function getFilteredActiveListingsSegments(segments: ActiveListingsSegments): ActiveListingsSegments {
  return {
    raw: segments.raw.filter((listing) => !listing.wasOutlierFiltered),
    psa9: segments.psa9.filter((listing) => !listing.wasOutlierFiltered),
    psa10: segments.psa10.filter((listing) => !listing.wasOutlierFiltered),
    otherGraded: segments.otherGraded.filter((listing) => !listing.wasOutlierFiltered),
    excluded: segments.excluded
  };
}

export function getVisibleActiveListings(segments: ActiveListingsSegments) {
  return [...segments.raw, ...segments.psa9, ...segments.psa10, ...segments.otherGraded];
}

export function getDefaultActiveMarketSegment(card: CardItem | null | undefined, segments: ActiveListingsSegments): ActiveMarketSegment {
  const gradingCompany = `${card?.gradingCompany ?? ""}`.trim().toUpperCase();
  const grade = `${card?.grade ?? ""}`.trim();

  if (card?.isGraded && gradingCompany === "PSA" && grade === "10") {
    return segments.psa10.length ? "psa10" : segments.raw.length ? "raw" : "psa10";
  }

  if (card?.isGraded && gradingCompany === "PSA" && grade === "9") {
    return segments.psa9.length ? "psa9" : segments.raw.length ? "raw" : "psa9";
  }

  if (segments.raw.length) return "raw";
  if (segments.psa9.length) return "psa9";
  if (segments.psa10.length) return "psa10";
  if (segments.otherGraded.length) return "otherGraded";
  return "raw";
}

export function getSegmentLabel(segment: ActiveMarketSegment): string {
  if (segment === "psa9") return "PSA 9";
  if (segment === "psa10") return "PSA 10";
  if (segment === "otherGraded") return "Other Graded";
  if (segment === "excluded") return "Excluded";
  return "Raw";
}
