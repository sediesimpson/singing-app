export type Pattern = {
  name: string;
  steps: { offset: number; syllable: string }[]; // offset = semitones above the root
};

export const FIVE_NOTE_SCALE: Pattern = {
  name: "5-note scale",
  steps: [
    { offset: 0, syllable: "Do" },
    { offset: 2, syllable: "Re" },
    { offset: 4, syllable: "Mi" },
    { offset: 5, syllable: "Fa" },
    { offset: 7, syllable: "Sol" },
    { offset: 5, syllable: "Fa" },
    { offset: 4, syllable: "Mi" },
    { offset: 2, syllable: "Re" },
    { offset: 0, syllable: "Do" },
  ],
};