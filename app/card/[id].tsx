import { Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ResultDetails } from "@/components/ResultDetails";
import { useAppState } from "@/state/AppState";

export default function CardDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { scanResultsById, history, cards } = useAppState();
  const card =
    (id ? scanResultsById[id] : undefined) ??
    history.find((x) => x.id === id) ??
    cards.find((x) => x.id === id);
  if (!card) return <Text>Card not found</Text>;
  return <ResultDetails card={card} sourceScanId={card.sourceScanId} detailBackHref={id ? `/card/${id}` : undefined} />;
}
