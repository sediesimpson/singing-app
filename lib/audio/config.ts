// How close counts as "in tune", in cents (100 cents = 1 semitone), per difficulty level
export const DIFFICULTY_LEVELS = {
  beginner: { label: "Beginner", inTuneCents: 20 },
  intermediate: { label: "Intermediate", inTuneCents: 15 },
  advanced: { label: "Advanced", inTuneCents: 10 },
} as const;

export type Difficulty = keyof typeof DIFFICULTY_LEVELS;

export const IN_TUNE_CENTS = DIFFICULTY_LEVELS.beginner.inTuneCents; // default when no level is given
