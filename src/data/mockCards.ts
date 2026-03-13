import { CardItem, ChatMessage, MarketNewsItem } from "@/types/models";

export const mockCards: CardItem[] = [
  {
    id: "card-1",
    playerName: "Ken Griffey Jr.",
    cardTitle: "1989 Upper Deck Rookie",
    year: 1989,
    brand: "Upper Deck",
    set: "Base Set",
    cardNumber: "#1",
    team: "Seattle Mariners",
    position: "OF",
    referenceValue: 980.5,
    rarityLevel: 4,
    rarityLabel: "Elite",
    condition: "NM-MT 8",
    description: "One of the defining rookie cards of the modern hobby and a benchmark for late-80s desirability.",
    playerInfo: {
      era: "Junk Wax to Modern Crossover",
      careerNote: "Hall of Famer with 630 career home runs and iconic hobby demand."
    },
    imageFront: "https://images.unsplash.com/photo-1521412644187-c49fa049e84d?auto=format&fit=crop&w=900&q=80",
    imageBack: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=900&q=80",
    dateScanned: "2026-03-06T12:00:00.000Z"
  },
  {
    id: "card-2",
    playerName: "Shohei Ohtani",
    cardTitle: "2018 Topps Chrome Rookie",
    year: 2018,
    brand: "Topps",
    set: "Chrome",
    cardNumber: "#150",
    team: "Los Angeles Dodgers",
    position: "P/DH",
    referenceValue: 1210.75,
    rarityLevel: 5,
    rarityLabel: "Grail",
    condition: "Mint 9",
    description: "A flagship modern rookie with sustained upside from one of baseball's most unique stars.",
    playerInfo: {
      era: "Modern",
      careerNote: "Dual-threat MVP talent with global collector demand."
    },
    imageFront: "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?auto=format&fit=crop&w=900&q=80",
    imageBack: "https://images.unsplash.com/photo-1531194402-2cc0a3f5d4e2?auto=format&fit=crop&w=900&q=80",
    dateScanned: "2026-03-05T09:30:00.000Z"
  },
  {
    id: "card-3",
    playerName: "Derek Jeter",
    cardTitle: "1993 SP Foil Rookie",
    year: 1993,
    brand: "Upper Deck",
    set: "SP",
    cardNumber: "#279",
    team: "New York Yankees",
    position: "SS",
    referenceValue: 760.25,
    rarityLevel: 3,
    rarityLabel: "Rare",
    condition: "NM 7",
    description: "Tough foil surface and legendary player profile keep this card in strong demand.",
    playerInfo: {
      era: "90s Premium",
      careerNote: "Five-time champion and long-term hobby anchor."
    },
    imageFront: "https://images.unsplash.com/photo-1576267423445-b2e0074d68a4?auto=format&fit=crop&w=900&q=80",
    imageBack: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=900&q=80",
    dateScanned: "2026-03-03T16:10:00.000Z"
  },
  {
    id: "card-4",
    playerName: "Julio Rodriguez",
    cardTitle: "2022 Bowman Chrome Prospect Auto",
    year: 2022,
    brand: "Bowman",
    set: "Chrome Prospect",
    cardNumber: "CPA-JR",
    team: "Seattle Mariners",
    position: "OF",
    referenceValue: 415.9,
    rarityLevel: 2,
    rarityLabel: "Notable",
    condition: "Mint 9",
    description: "Popular modern chrome autograph with strong fanbase and long-term upside profile.",
    playerInfo: {
      era: "Modern Prospect Boom",
      careerNote: "Face-of-franchise candidate with premium hobby momentum."
    },
    imageFront: "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=900&q=80",
    imageBack: "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=900&q=80",
    dateScanned: "2026-03-01T19:42:00.000Z"
  }
];

export const trendingCards = [
  { id: "t1", title: "Ohtani 2018 Chrome RC", move: "+14.2%" },
  { id: "t2", title: "Elly De La Cruz 1st Bowman", move: "+9.8%" },
  { id: "t3", title: "Griffey 1989 UD #1", move: "+6.4%" }
];

export const marketNews: MarketNewsItem[] = [
  { id: "n1", headline: "Vintage catcher set closes above estimate at weekend auction", source: "CardDesk", timeAgo: "2h ago" },
  { id: "n2", headline: "Chrome rookie autos tighten after grading pop report update", source: "Hobby Wire", timeAgo: "5h ago" },
  { id: "n3", headline: "Collectors rotating into 90s inserts as modern prices normalize", source: "Market Dugout", timeAgo: "1d ago" }
];

export const aiStarters = [
  "Is this worth grading?",
  "Why is this card valuable?",
  "How rare is this card?",
  "Tell me about this set"
];

export const sampleChat: ChatMessage[] = [
  { id: "m1", role: "assistant", text: "This one has strong eye appeal. Centering and corners look clean enough for a realistic grade bump." },
  { id: "m2", role: "user", text: "Is this worth grading?" },
  { id: "m3", role: "assistant", text: "If you can submit under a bulk tier, yes. At your reference value, a one-grade jump gives meaningful upside." }
];
