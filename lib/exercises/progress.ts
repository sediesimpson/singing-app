import type { Difficulty } from "@/lib/audio/config";
import { VOICE_RANGES, type Voice } from "./voices";

// One saved round, as the progress page uses it
export type SavedAttempt = {
  targetMidi: number;
  voice: Voice;
  difficulty: Difficulty;
  accuracy: number; // 0–100
  avgCents: number; // + sharp (too high), − flat (too low)
  createdAt: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const average = (xs: number[]): number | null =>
  xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : null;

// A calendar day in the viewer's own time zone, e.g. "2026-10-21"
export function dayKey(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Days in a row with at least one round. Still alive if you practised yesterday but not yet today.
export function dayStreak(attempts: SavedAttempt[], now = new Date()): number {
  const days = new Set(attempts.map((a) => dayKey(a.createdAt)));
  const day = new Date(now);
  if (!days.has(dayKey(day))) day.setDate(day.getDate() - 1);

  let streak = 0;
  while (days.has(dayKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export type Summary = {
  rounds: number;
  averageScore: number | null;
  bestScore: number | null;
  changeVsLastWeek: number | null; // this week's average minus last week's, in points
};

export function summarise(attempts: SavedAttempt[], now = new Date()): Summary {
  const age = (a: SavedAttempt) => now.getTime() - a.createdAt.getTime();
  const thisWeek = average(attempts.filter((a) => age(a) < 7 * DAY_MS).map((a) => a.accuracy));
  const lastWeek = average(
    attempts.filter((a) => age(a) >= 7 * DAY_MS && age(a) < 14 * DAY_MS).map((a) => a.accuracy)
  );
  const overall = average(attempts.map((a) => a.accuracy));

  return {
    rounds: attempts.length,
    averageScore: overall === null ? null : Math.round(overall),
    bestScore: attempts.length ? Math.max(...attempts.map((a) => a.accuracy)) : null,
    changeVsLastWeek: thisWeek !== null && lastWeek !== null ? Math.round(thisWeek - lastWeek) : null,
  };
}

export type DayPoint = { day: Date; accuracy: number; rounds: number };

// Average score per calendar day over the last `days` days, oldest first
export function dailyAccuracy(attempts: SavedAttempt[], days = 30, now = new Date()): DayPoint[] {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  const byDay = new Map<string, { day: Date; scores: number[] }>();
  for (const a of attempts) {
    if (a.createdAt < start) continue;
    const key = dayKey(a.createdAt);
    if (!byDay.has(key)) {
      const day = new Date(a.createdAt);
      day.setHours(0, 0, 0, 0);
      byDay.set(key, { day, scores: [] });
    }
    byDay.get(key)!.scores.push(a.accuracy);
  }

  return [...byDay.values()]
    .map(({ day, scores }) => ({ day, accuracy: Math.round(average(scores)!), rounds: scores.length }))
    .sort((a, b) => a.day.getTime() - b.day.getTime());
}

// Do you usually sing too high or too low? Average offset of your latest rounds, in cents.
export function tendency(attempts: SavedAttempt[], latest = 50): number | null {
  const recent = [...attempts]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, latest);
  const avg = average(recent.map((a) => a.avgCents));
  return avg === null ? null : Math.round(avg);
}

export type NoteStat = { midi: number; accuracy: number | null; rounds: number };
export type RangeBand = { name: "low" | "middle" | "high"; accuracy: number | null; rounds: number; notes: NoteStat[] };

// Split a voice range into low / middle / high thirds and score each, plus each note inside it
export function rangeBands(attempts: SavedAttempt[], voice: Voice): RangeBand[] {
  const { low, high } = VOICE_RANGES[voice];
  const notes: NoteStat[] = [];
  for (let midi = low; midi <= high; midi++) {
    const scores = attempts.filter((a) => a.targetMidi === midi).map((a) => a.accuracy);
    const avg = average(scores);
    notes.push({ midi, accuracy: avg === null ? null : Math.round(avg), rounds: scores.length });
  }

  // 13 notes -> 4 low, 5 middle, 4 high
  const edge = Math.floor(notes.length / 3);
  const groups = [
    { name: "low" as const, notes: notes.slice(0, edge) },
    { name: "middle" as const, notes: notes.slice(edge, notes.length - edge) },
    { name: "high" as const, notes: notes.slice(notes.length - edge) },
  ];

  return groups.map(({ name, notes }) => {
    const midis = new Set(notes.map((n) => n.midi));
    const scores = attempts.filter((a) => midis.has(a.targetMidi)).map((a) => a.accuracy);
    const avg = average(scores);
    return { name, notes, rounds: scores.length, accuracy: avg === null ? null : Math.round(avg) };
  });
}

// Whichever option you've played most, so the page opens on what you actually practise
export function mostPlayed<T extends string>(values: T[], fallback: T): T {
  const counts = new Map<T, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = fallback;
  let bestCount = 0;
  for (const [v, n] of counts) {
    if (n > bestCount) {
      best = v;
      bestCount = n;
    }
  }
  return best;
}
