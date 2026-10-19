"use client";

import { usePitch } from "@/lib/audio/usePitch";

export default function Home() {
  const { reading, isListening, error, start, stop } = usePitch();

  const centsColor =
    reading && Math.abs(reading.cents) <= 10
      ? "text-green-600"
      : "text-amber-600";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-medium">Pitch detector</h1>

      <div className="text-7xl font-medium h-24">
        {reading ? reading.note : "—"}
      </div>

      <div className={`text-lg h-7 ${reading ? centsColor : ""}`}>
        {reading &&
          `${reading.cents > 0 ? "+" : ""}${reading.cents} cents · ${reading.frequency.toFixed(1)} Hz`}
      </div>

      <button
        onClick={isListening ? stop : start}
        className="rounded-lg border px-6 py-3 hover:bg-gray-100"
      >
        {isListening ? "Stop" : "Start listening"}
      </button>

      {error && <p className="text-red-600">{error}</p>}
    </main>
  );
}