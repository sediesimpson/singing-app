export const VOICE_RANGES = {
  lower: { label: "Lower voice", low: 45, high: 57 },  // A2–A3
  higher: { label: "Higher voice", low: 57, high: 69 }, // A3–A4
} as const;

export type Voice = keyof typeof VOICE_RANGES;

export function randomNoteInRange(low: number, high: number, avoid: number | null = null): number {
  let note: number;
  do {
    note = low + Math.floor(Math.random() * (high - low + 1));
  } while (note === avoid && high > low);
  return note;
}