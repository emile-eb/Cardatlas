export type OnboardingStepType = "intro" | "single" | "multi" | "final";

export type OnboardingQuestionStep = {
  id: string;
  type: OnboardingStepType;
  title: string;
  subtitle?: string;
  helper?: string;
  options?: string[];
  ctaLabel: string;
};

export const onboardingSteps: OnboardingQuestionStep[] = [
  {
    id: "intro",
    type: "intro",
    title: "Let's build your\ncollector profile",
    subtitle:
      "Answer a few quick questions so CardAtlas can tailor your collection, pricing, and collector intelligence experience.",
    ctaLabel: "Get Started"
  },
  {
    id: "collectorType",
    type: "single",
    title: "What kind of collector are you?",
    options: [
      "Just getting started",
      "Casual collector",
      "Serious collector",
      "Investor / flipper",
      "Shop owner / dealer"
    ],
    ctaLabel: "Continue"
  },
  {
    id: "sports",
    type: "multi",
    title: "What sports do you collect?",
    helper: "Select all that apply",
    options: ["Baseball", "Basketball", "Football", "Soccer", "Hockey", "Mixed / everything"],
    ctaLabel: "Continue"
  },
  {
    id: "goals",
    type: "multi",
    title: "What do you mainly want help with?",
    helper: "Select all that apply",
    options: [
      "Tracking my collection",
      "Checking card values",
      "Finding rare cards",
      "Researching cards",
      "Selling cards",
      "Learning the hobby"
    ],
    ctaLabel: "Continue"
  },
  {
    id: "collectionSize",
    type: "single",
    title: "How big is your collection?",
    options: ["0–10 cards", "10–100 cards", "100–500 cards", "500+ cards"],
    ctaLabel: "Continue"
  },
  {
    id: "cardTypes",
    type: "multi",
    title: "What types of cards interest you most?",
    helper: "Select all that apply",
    options: [
      "Rookie cards",
      "Autographs",
      "Graded cards",
      "Vintage cards",
      "Modern cards",
      "Parallels / inserts",
      "I collect everything"
    ],
    ctaLabel: "Continue"
  },
  {
    id: "brands",
    type: "multi",
    title: "What brands or sets do you collect most?",
    helper: "Select all that apply",
    options: ["Topps", "Bowman", "Panini", "Upper Deck", "Vintage sets", "I collect everything"],
    ctaLabel: "Continue"
  },
  {
    id: "alerts",
    type: "single",
    title: "Do you want market and value alerts?",
    options: ["Yes, price increases", "Yes, price drops", "Both", "No alerts for now"],
    ctaLabel: "Continue"
  }
];
