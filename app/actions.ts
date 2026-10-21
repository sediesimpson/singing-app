"use server";

import { createClient } from "@/lib/supabase/server";
import { DIFFICULTY_LEVELS, type Difficulty } from "@/lib/audio/config";
import { VOICE_RANGES, type Voice } from "@/lib/exercises/voices";

export type NewAttempt = {
  targetMidi: number;
  voice: Voice;
  difficulty: Difficulty;
  accuracy: number;
  avgCents: number;
  sampleCount: number;
};

// Save one scored round of match-the-note for whoever is logged in.
// Anyone can call a Server Action directly, so check the login and the values here
// rather than trusting the page.
export async function saveAttempt(attempt: NewAttempt): Promise<{ ok: boolean }> {
  if (!(attempt.voice in VOICE_RANGES) || !(attempt.difficulty in DIFFICULTY_LEVELS)) {
    return { ok: false };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false };

  // user_id is filled in by the database from the login, and RLS rejects anyone else's
  const { error } = await supabase.from("attempts").insert({
    exercise: "match",
    target_midi: attempt.targetMidi,
    voice: attempt.voice,
    difficulty: attempt.difficulty,
    in_tune_cents: DIFFICULTY_LEVELS[attempt.difficulty].inTuneCents,
    accuracy: attempt.accuracy,
    avg_cents: attempt.avgCents,
    sample_count: attempt.sampleCount,
  });
  return { ok: !error };
}
