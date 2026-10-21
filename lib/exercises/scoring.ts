import { IN_TUNE_CENTS } from "@/lib/audio/config";

export type Sample = { t: number; midi: number };

export type AttemptResult = {
  accuracy: number;   // 0–100: % of the time you were in tune
  avgCents: number;   // average offset: + means sharp, − means flat
  sampleCount: number;
};

export type ScoreOptions = {
  settleMs?: number;   // ignore this long at the start while you find the note
  minSamples?: number; // fewer than this = we didn't really hear you
  inTuneCents?: number; // how close counts as in tune (depends on difficulty)
};

const SETTLE_MS = 500;
const MIN_SAMPLES = 10;

// Notes in a sequence are short, so be quicker to start scoring and need less data
const SEQUENCE_SETTLE_MS = 150;
const SEQUENCE_MIN_SAMPLES = 5;

// How far off the target you are, ignoring which octave you sang in
export function centsFromTarget(midi: number, target: number): number {
  const raw = (midi - target) * 100;
  return (((raw % 1200) + 1800) % 1200) - 600;
}

export function scoreAttempt(
  samples: Sample[],
  target: number,
  singStartedAt: number,
  { settleMs = SETTLE_MS, minSamples = MIN_SAMPLES, inTuneCents = IN_TUNE_CENTS }: ScoreOptions = {}
): AttemptResult | null {
  const usable = samples.filter((s) => s.t - singStartedAt >= settleMs);
  if (usable.length < minSamples) return null;

  const offsets = usable.map((s) => centsFromTarget(s.midi, target));
  const inTune = offsets.filter((c) => Math.abs(c) <= inTuneCents).length;
  const avg = offsets.reduce((sum, c) => sum + c, 0) / offsets.length;

  return {
    accuracy: Math.round((inTune / offsets.length) * 100),
    avgCents: Math.round(avg),
    sampleCount: usable.length,
  };
}

// One slot in a sequence: which note to sing, and when
export type NoteWindow = { target: number; start: number; end: number };

export type SequenceResult = {
  perNote: (AttemptResult | null)[]; // null = we didn't hear that note
  overall: number;                   // 0–100, missed notes count as 0
};

export function scoreSequence(samples: Sample[], windows: NoteWindow[]): SequenceResult {
  const perNote = windows.map((w) =>
    scoreAttempt(
      samples.filter((s) => s.t >= w.start && s.t < w.end),
      w.target,
      w.start,
      { settleMs: SEQUENCE_SETTLE_MS, minSamples: SEQUENCE_MIN_SAMPLES }
    )
  );

  const total = perNote.reduce((sum, r) => sum + (r?.accuracy ?? 0), 0);
  return {
    perNote,
    overall: windows.length ? Math.round(total / windows.length) : 0,
  };
}
