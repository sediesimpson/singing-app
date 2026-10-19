"use client";

import { useState } from "react";
import { usePitch } from "@/lib/audio/usePitch";
import { midiToNoteName } from "@/lib/audio/notes";
import { IN_TUNE_CENTS } from "@/lib/audio/config";
import { PitchGraph } from "@/components/PitchGraph";

const TARGET_OPTIONS = Array.from({ length: 25 }, (_, i) => 45 + i); // A2 up to A4

export default function Home() {
  const { reading, isListening, error, start, stop } = usePitch();
  const [targetMidi, setTargetMidi] = useState<number | null>(null);

  const centsOff = reading
    ? targetMidi !== null
      ? Math.round((reading.midi - targetMidi) * 100)
      : reading.cents
    : null;

  const centsColor =
    centsOff !== null && Math.abs(centsOff) <= IN_TUNE_CENTS
      ? "text-green-600"
      : "text-amber-600";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-medium">Pitch trainer</h1>

      <div className="w-full max-w-2xl flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-6xl font-medium h-20">
              {reading ? reading.note : "—"}
            </div>
            <div className={`text-lg h-7 ${reading ? centsColor : ""}`}>
              {centsOff !== null &&
                `${centsOff > 0 ? "+" : ""}${centsOff} cents${targetMidi !== null ? " from target" : ""}`}
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-500">
            Target note
            <select
              className="rounded-lg border px-3 py-2 text-base text-inherit"
              value={targetMidi ?? ""}
              onChange={(e) =>
                setTargetMidi(e.target.value === "" ? null : Number(e.target.value))
              }
            >
              <option value="">None (free singing)</option>
              {TARGET_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {midiToNoteName(m)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <PitchGraph reading={reading} targetMidi={targetMidi} />

        <button
          onClick={isListening ? stop : start}
          className="self-center rounded-lg border px-6 py-3 hover:bg-gray-100"
        >
          {isListening ? "Stop" : "Start listening"}
        </button>

        {error && <p className="text-red-600 text-center">{error}</p>}
      </div>
    </main>
  );
}