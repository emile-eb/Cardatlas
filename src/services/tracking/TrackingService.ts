import { getRequiredSupabaseClient } from "@/lib/supabase/client";

class TrackingService {
  private pendingByCardId = new Map<string, Promise<void>>();
  private ensuredCardIds = new Set<string>();

  ensureTrackedCard(cardId: string): Promise<void> {
    const normalizedCardId = `${cardId ?? ""}`.trim();
    if (!normalizedCardId || this.ensuredCardIds.has(normalizedCardId)) {
      return Promise.resolve();
    }

    const pending = this.pendingByCardId.get(normalizedCardId);
    if (pending) return pending;

    const run = (async () => {
      try {
        const supabase = await getRequiredSupabaseClient();
        const { error } = await supabase.functions.invoke("ensure-card-tracking", {
          body: { cardId: normalizedCardId }
        });
        if (error) throw error;
        this.ensuredCardIds.add(normalizedCardId);
      } catch (error) {
        if (__DEV__) {
          console.log("[tracking] ensure_failed", { cardId: normalizedCardId, error });
        }
        throw error;
      } finally {
        this.pendingByCardId.delete(normalizedCardId);
      }
    })();

    this.pendingByCardId.set(normalizedCardId, run);
    return run;
  }
}

export const trackingService = new TrackingService();
