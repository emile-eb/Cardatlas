import type { ProviderListing } from "@/services/marketPulse/types";

function asIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function normalizeProviderListings(listings: ProviderListing[]) {
  return listings.map((listing, index) => ({
    source: listing.source || "unknown",
    source_listing_id: listing.sourceListingId ?? null,
    title: listing.title,
    subtitle: listing.subtitle ?? null,
    image_url: listing.imageUrl ?? null,
    item_web_url: listing.itemWebUrl ?? null,
    price: typeof listing.price === "number" ? listing.price : null,
    currency: listing.currency || "USD",
    item_origin_date: asIsoOrNull(listing.itemOriginDate ?? null),
    buying_options: listing.buyingOptions ?? null,
    marketplace_id: listing.marketplaceId ?? "EBAY_US",
    card_id: listing.cardId ?? null,
    sport: listing.sport ?? null,
    player_name: listing.playerName ?? null,
    team: listing.team ?? null,
    pulse_reason: listing.pulseReason ?? "New Listing",
    is_mock: Boolean(listing.isMock),
    sort_order: index,
    raw_payload: listing.rawPayload ?? {
      cardIdentity: {
        year: listing.year ?? null,
        brand: listing.brand ?? null,
        setName: listing.setName ?? null,
        cardNumber: listing.cardNumber ?? null
      },
      marketContext: {
        referenceValue: listing.referenceValue ?? null,
        activeMarketAverageAsk: listing.activeMarketAverageAsk ?? null,
        lowestAsk: listing.lowestAsk ?? null,
        listingCount: listing.listingCount ?? null,
        pulseScore: listing.signalStrengthScore ?? null,
        refreshedAt: asIsoOrNull(listing.lastRefreshedAt ?? null)
      }
    }
  }));
}
