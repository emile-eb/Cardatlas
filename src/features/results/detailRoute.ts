import type { CardItem } from "@/types/models";

export function findCollectionCard(cards: CardItem[], id: string, collectionItemId?: string) {
  return (
    cards.find((card) => card.collectionItemId === collectionItemId) ??
    cards.find((card) => card.sourceScanId === id) ??
    cards.find((card) => card.collectionItemId === id) ??
    cards.find((card) => card.id === id) ??
    null
  );
}

export function resolveResultsDetailBackHref(input: {
  backTo?: string;
  isCollectionContext: boolean;
  collectionItemId?: string;
  resultId?: string;
}) {
  if (input.backTo) return input.backTo;
  if (input.isCollectionContext && input.collectionItemId) {
    return `/collection/manage/${input.collectionItemId}`;
  }
  if (input.resultId) {
    return `/results/${input.resultId}`;
  }
  return "/(tabs)/home";
}
