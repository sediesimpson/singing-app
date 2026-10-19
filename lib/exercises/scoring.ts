import { IN_TUNE_CENTS } from "@/lib/audio/config";

export type Sample = { t: number; midi: number };

export type AttemptResult = {
  accuracy: number;   // 0–100: % of the time you were in tune
  avgCents: number;   // average offset: + means sharp, − means flat
  sampleCount: number;
};

const SETTLE_MS = 500;  // ignore the first half-second while you find the note
const MIN_SAMPLES = 10; // fewer than this = we didn't really hear you

// How far off the target you are, ignoring which octave you sang in
export function centsFromTarget(midi: number, target: number): number {
  const raw = (midi - target) * 100;
  return (((raw % 1200) + 1800) % 1200) - 600;
}

export function scoreAttempt(
  samples: Sample[],
  target: number,
  singStartedAt: number
): AttemptResult | null {
  const usable = samples.filter((s) => s.t - singStartedAt >= SETTLE_MS);
  if (usable.length < MIN_SAMPLES) return null;

  const offsets = usable.map((s) => centsFromTarget(s.midi, target));
  const inTune = offsets.filter((c) => Math.abs(c) <= IN_TUNE_CENTS).length;
  const avg = offsets.reduce((sum, c) => sum + c, 0) / offsets.length;

  return {
    accuracy: Math.round((inTune / offsets.length) * 100),
    avgCents: Math.round(avg),
    sampleCount: usable.length,
  };
}