const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function frequencyToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const name = NOTE_NAMES[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return `${name}${octave}`;
}

export type NoteReading = {
  frequency: number;
  note: string;   // e.g. "A3"
  midi: number;   // exact, e.g. 56.88
  cents: number;  // -50 to +50: how far off the nearest note you are
};

export function frequencyToNote(freq: number): NoteReading {
  const midi = frequencyToMidi(freq);
  const nearest = Math.round(midi);
  return {
    frequency: freq,
    note: midiToNoteName(nearest),
    midi,
    cents: Math.round((midi - nearest) * 100),
  };
}