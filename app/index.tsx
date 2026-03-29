import { Redirect } from "expo-router";
import { useAppState } from "@/state/AppState";
import { useAuth } from "@/features/auth";

export default function IndexScreen() {
  const { startupRoute } = useAppState();
  const { status } = useAuth();

  if (status === "idle" || status === "loading") {
    return <Redirect href="/splash" />;
  }

  return <Redirect href={startupRoute} />;
}
