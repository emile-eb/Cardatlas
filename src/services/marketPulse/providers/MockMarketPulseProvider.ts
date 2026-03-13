import type { MarketPulseProvider } from "@/services/marketPulse/providers/MarketPulseProvider";
import type { ProviderFetchInput, ProviderFetchResult, ProviderListing } from "@/services/marketPulse/types";

const MOCK_LISTINGS: ProviderListing[] = [
  {
    source: "ebay",
    sourceListingId: "mock-ebay-001",
    title: "2023 Topps Chrome Corbin Carroll RC Refractor",
    subtitle: "Arizona Diamondbacks • Rookie Card",
    imageUrl: "https://images.unsplash.com/photo-1615655096345-61a54750068d?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 74.99,
    currency: "USD",
    sport: "Baseball",
    playerName: "Corbin Carroll",
    team: "Arizona Diamondbacks",
    pulseReason: "Hot Rookie"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-002",
    title: "2020 Prizm Anthony Edwards Silver Rookie",
    subtitle: "Minnesota Timberwolves • PSA 10",
    imageUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 189.0,
    currency: "USD",
    sport: "Basketball",
    playerName: "Anthony Edwards",
    team: "Minnesota Timberwolves",
    pulseReason: "Collector Pick"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-003",
    title: "2018 Donruss Optic Luka Doncic Rated Rookie",
    subtitle: "Dallas Mavericks • Raw Listing",
    imageUrl: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 132.5,
    currency: "USD",
    sport: "Basketball",
    playerName: "Luka Doncic",
    team: "Dallas Mavericks",
    pulseReason: "Premium Card"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-004",
    title: "2021 Mosaic Ja'Marr Chase Rookie Orange",
    subtitle: "Cincinnati Bengals • New listing",
    imageUrl: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 58.0,
    currency: "USD",
    sport: "Football",
    playerName: "Ja'Marr Chase",
    team: "Cincinnati Bengals",
    pulseReason: "New Listing"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-005",
    title: "2017 Panini Select Patrick Mahomes RC Concourse",
    subtitle: "Kansas City Chiefs • Raw",
    imageUrl: "https://picsum.photos/seed/cardatlas-marketpulse-005/800/600",
    itemWebUrl: "https://www.ebay.com",
    price: 169.99,
    currency: "USD",
    sport: "Football",
    playerName: "Patrick Mahomes",
    team: "Kansas City Chiefs",
    pulseReason: "Collector Pick"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-006",
    title: "2019 Topps Chrome UEFA Erling Haaland Rookie",
    subtitle: "Borussia Dortmund • UCL set",
    imageUrl: "https://images.unsplash.com/photo-1522778526097-ce0a22ceb253?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 210.0,
    currency: "USD",
    sport: "Soccer",
    playerName: "Erling Haaland",
    team: "Borussia Dortmund",
    pulseReason: "Hot Rookie"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-007",
    title: "2020 Prizm Justin Herbert Rookie Silver",
    subtitle: "Los Angeles Chargers • PSA 9",
    imageUrl: "https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 248.75,
    currency: "USD",
    sport: "Football",
    playerName: "Justin Herbert",
    team: "Los Angeles Chargers",
    pulseReason: "Premium Card"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-008",
    title: "2018 Topps Update Ronald Acuna Jr. US250",
    subtitle: "Atlanta Braves • Rookie Debut",
    imageUrl: "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 64.0,
    currency: "USD",
    sport: "Baseball",
    playerName: "Ronald Acuna Jr.",
    team: "Atlanta Braves",
    pulseReason: "New Listing"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-009",
    title: "2015 Prizm Kylian Mbappe Base Rookie",
    subtitle: "AS Monaco • PSG era collectors",
    imageUrl: "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 145.0,
    currency: "USD",
    sport: "Soccer",
    playerName: "Kylian Mbappe",
    team: "AS Monaco",
    pulseReason: "Collector Pick"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-010",
    title: "2016 Young Guns Auston Matthews Rookie",
    subtitle: "Toronto Maple Leafs • Hockey",
    imageUrl: "https://images.unsplash.com/photo-1515703407324-5f753afd8be8?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 96.25,
    currency: "USD",
    sport: "Hockey",
    playerName: "Auston Matthews",
    team: "Toronto Maple Leafs",
    pulseReason: "New Listing"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-011",
    title: "2023 Bowman Chrome Druw Jones 1st Bowman",
    subtitle: "Arizona Diamondbacks prospect",
    imageUrl: "https://picsum.photos/seed/cardatlas-marketpulse-011/800/600",
    itemWebUrl: "https://www.ebay.com",
    price: 52.0,
    currency: "USD",
    sport: "Baseball",
    playerName: "Druw Jones",
    team: "Arizona Diamondbacks",
    pulseReason: "Hot Rookie"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-012",
    title: "2021 Prizm Cade Cunningham Rookie Purple Wave",
    subtitle: "Detroit Pistons • Raw condition",
    imageUrl: "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 72.25,
    currency: "USD",
    sport: "Basketball",
    playerName: "Cade Cunningham",
    team: "Detroit Pistons",
    pulseReason: "Collector Pick"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-013",
    title: "2012 Prizm Russell Wilson Rookie",
    subtitle: "Seattle Seahawks • First-year Prizm",
    imageUrl: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 124.99,
    currency: "USD",
    sport: "Football",
    playerName: "Russell Wilson",
    team: "Seattle Seahawks",
    pulseReason: "Premium Card"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-014",
    title: "2022 Topps Chrome Julio Rodriguez RC",
    subtitle: "Seattle Mariners • PSA 10 candidate",
    imageUrl: "https://images.unsplash.com/photo-1508344928928-7165b67de128?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 98.5,
    currency: "USD",
    sport: "Baseball",
    playerName: "Julio Rodriguez",
    team: "Seattle Mariners",
    pulseReason: "Hot Rookie"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-015",
    title: "2019 Panini Select Kyler Murray Rookie",
    subtitle: "Arizona Cardinals • New today",
    imageUrl: "https://images.unsplash.com/photo-1486286701208-1d58e9338013?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 48.0,
    currency: "USD",
    sport: "Football",
    playerName: "Kyler Murray",
    team: "Arizona Cardinals",
    pulseReason: "New Listing"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-016",
    title: "2018 Select Trae Young Rookie Tri-Color",
    subtitle: "Atlanta Hawks • Short print",
    imageUrl: "https://images.unsplash.com/photo-1515523110800-9415d13b84a8?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 118.0,
    currency: "USD",
    sport: "Basketball",
    playerName: "Trae Young",
    team: "Atlanta Hawks",
    pulseReason: "Collector Pick"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-017",
    title: "2020 Topps Chrome F1 Lewis Hamilton Refractor",
    subtitle: "Mercedes-AMG Petronas",
    imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 312.0,
    currency: "USD",
    sport: "Motorsport",
    playerName: "Lewis Hamilton",
    team: "Mercedes",
    pulseReason: "Premium Card"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-018",
    title: "2019 Upper Deck Cale Makar Young Guns RC",
    subtitle: "Colorado Avalanche • NHL rookie",
    imageUrl: "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 84.5,
    currency: "USD",
    sport: "Hockey",
    playerName: "Cale Makar",
    team: "Colorado Avalanche",
    pulseReason: "New Listing"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-019",
    title: "2017 Topps Chrome Aaron Judge RC",
    subtitle: "New York Yankees • Home run chase",
    imageUrl: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 101.0,
    currency: "USD",
    sport: "Baseball",
    playerName: "Aaron Judge",
    team: "New York Yankees",
    pulseReason: "Collector Pick"
  },
  {
    source: "ebay",
    sourceListingId: "mock-ebay-020",
    title: "2023 Panini Select Victor Wembanyama Draft RC",
    subtitle: "San Antonio Spurs • New pull",
    imageUrl: "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=800&q=80",
    itemWebUrl: "https://www.ebay.com",
    price: 265.0,
    currency: "USD",
    sport: "Basketball",
    playerName: "Victor Wembanyama",
    team: "San Antonio Spurs",
    pulseReason: "Hot Rookie"
  }
];

function withFreshTimestamps(listings: ProviderListing[], limit: number): ProviderListing[] {
  const now = Date.now();
  return listings.slice(0, limit).map((listing, index) => ({
    ...listing,
    isMock: true,
    marketplaceId: listing.marketplaceId ?? "EBAY_US",
    itemOriginDate: new Date(now - index * 32 * 60 * 1000).toISOString()
  }));
}

class MockMarketPulseProviderImpl implements MarketPulseProvider {
  readonly providerId = "mock" as const;

  async fetchLatestListings(input: ProviderFetchInput): Promise<ProviderFetchResult> {
    const listings = withFreshTimestamps(MOCK_LISTINGS, input.limit);
    return {
      source: "mock",
      listings,
      isMock: true
    };
  }
}

export const mockMarketPulseProvider: MarketPulseProvider = new MockMarketPulseProviderImpl();
