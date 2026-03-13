import { useAppState } from "@/state/AppState";

export function useHomeDashboard() {
  const { homeDashboard } = useAppState();
  return homeDashboard;
}
