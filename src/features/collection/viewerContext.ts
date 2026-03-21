type CollectionViewerContext = {
  orderedIds: string[];
  createdAt: number;
};

let currentContext: CollectionViewerContext | null = null;

export function setCollectionViewerContext(orderedIds: string[]) {
  currentContext = {
    orderedIds,
    createdAt: Date.now()
  };
}

export function getCollectionViewerContext() {
  return currentContext;
}
