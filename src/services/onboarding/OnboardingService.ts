import { getRequiredSupabaseClient } from "@/lib/supabase/client";
import type { UUID } from "@/types";

export interface OnboardingProfileInput {
  collectorType?: string;
  sports: string[];
  goals: string[];
  collectionSize?: string;
  cardTypes: string[];
  brands: string[];
  alerts?: string;
}

export interface OnboardingService {
  saveAnswers(userId: UUID, profile: OnboardingProfileInput): Promise<void>;
  markCompleted(userId: UUID): Promise<void>;
  isCompleted(userId: UUID): Promise<boolean>;
}

class OnboardingServiceImpl implements OnboardingService {
  async saveAnswers(userId: UUID, profile: OnboardingProfileInput): Promise<void> {
    const supabase = await getRequiredSupabaseClient();

    const { error } = await supabase.from("onboarding_answers").upsert(
      {
        user_id: userId,
        collector_type: profile.collectorType ?? "unspecified",
        sports: profile.sports,
        goals: profile.goals,
        collection_size: profile.collectionSize ?? "unspecified",
        card_types: profile.cardTypes,
        brands: profile.brands,
        alerts_preference: profile.alerts ?? "none",
        completed_at: new Date().toISOString()
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;
  }

  async markCompleted(userId: UUID): Promise<void> {
    const supabase = await getRequiredSupabaseClient();
    const { error } = await supabase
      .from("users")
      .update({ is_onboarding_complete: true })
      .eq("id", userId);

    if (error) throw error;
  }

  async isCompleted(userId: UUID): Promise<boolean> {
    const supabase = await getRequiredSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("is_onboarding_complete")
      .eq("id", userId)
      .single();

    if (error) throw error;
    return Boolean(data.is_onboarding_complete);
  }
}

export const onboardingService: OnboardingService = new OnboardingServiceImpl();
