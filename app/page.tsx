"use client";

import { useEffect, useRef, useState } from "react";
import { usePitch } from "@/lib/audio/usePitch";
import { playTone, preloadTone } from "@/lib/audio/tonePlayer";
import { midiToNoteName } from "@/lib/audio/notes";
import { IN_TUNE_CENTS } from "@/lib/audio/config";
import { scoreAttempt, type AttemptResult, type Sample } from "@/lib/exercises/scoring";
import { PitchGraph } from "@/components/PitchGraph";
import { sleep } from "@/lib/utils";
import { VOICE_RANGES, randomNoteInRange, type Voice } from "@/lib/exercises/voices";

type Phase = "idle" | "listen" | "sing" | "result";

const TONE_SECONDS = 1.5;
const GAP_MS = 300;
const SING_MS = 3000;

function pickTarget(voice: Voice, previous: number | null): number {
  const { low, high } = VOICE_RANGES[voice];
  return randomNoteInRange(low, high, previous);
}

function feedback(r: AttemptResult): string {
  if (r.accuracy >= 70) return "Spot on. You matched it.";
  if (r.avgCents > IN_TUNE_CENTS) return "Close. You were a bit sharp (too high), so aim slightly lower.";
  if (r.avgCents < -IN_TUNE_CENTS) return "Close. You were a bit flat (too low), so aim slightly higher.";
  return "Close. You were wobbling around the note, so try holding it steadier.";
}

export default function MatchPage() {
  const { reading, isListening, error, start } = usePitch();
  const [voice, setVoice] = useState<Voice>("lower");
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResult | "no-voice" | null>(null);

  const samplesRef = useRef<Sample[]>([]);
  const singStartRef = useRef(0);

  // While you're singing, collect every pitch reading with a timestamp
  useEffect(() => {
    if (phase === "sing" && reading) {
      samplesRef.current.push({ t: performance.now(), midi: reading.midi });
    }
  }, [phase, reading]);

  useEffect(() => {
    preloadTone();
  }, []);

  async function runRound(note: number) {
    if (!isListening) await start();
    setResult(null);
    setTarget(note);

    setPhase("listen");
    await playTone(note, TONE_SECONDS);
    await sleep(GAP_MS);

    samplesRef.current = [];
    singStartRef.current = performance.now();
    setPhase("sing");
    await sleep(SING_MS);

    const score = scoreAttempt(samplesRef.current, note, singStartRef.current);
    setResult(score ?? "no-voice");
    setPhase("result");
  }

  const busy = phase === "listen" || phase === "sing";

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-8">
      <div className="w-full max-w-2xl flex items-center justify-end">
        <div className="flex gap-2">
          {(Object.keys(VOICE_RANGES) as Voice[]).map((v) => (
            <button
              key={v}
              onClick={() => setVoice(v)}
              className={`rounded-lg border px-3 py-1 text-sm ${voice === v ? "bg-gray-100 font-medium" : ""}`}
            >
              {VOICE_RANGES[v].label}
            </button>
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-medium">Match the note</h1>

      <div className="h-24 flex flex-col items-center justify-center text-center">
        {phase === "idle" && <p className="text-gray-500">Press play, listen to the note, then sing it back.</p>}
        {phase === "listen" && <p className="text-2xl">Listen…</p>}
        {phase === "sing" && <p className="text-2xl font-medium text-green-600">Now sing it!</p>}
        {phase === "result" && result === "no-voice" && (
          <p className="text-amber-600">I didn&apos;t hear you. Try singing a bit louder or closer to the mic.</p>
        )}
        {phase === "result" && result && result !== "no-voice" && (
          <>
            <p className="text-5xl font-medium">{result.accuracy}%</p>
            <p className="text-gray-600">{feedback(result)}</p>
          </>
        )}
      </div>

      <div className="w-full max-w-2xl">
        {target !== null && (
          <p className="text-sm text-gray-500 mb-2">Target: {midiToNoteName(target)}</p>
        )}
        <PitchGraph reading={reading} targetMidi={target} paused={phase === "result"} />
      </div>

      {!busy && (
        <div className="flex gap-3">
          {phase === "result" && target !== null && (
            <button onClick={() => runRound(target)} className="rounded-lg border px-6 py-3 hover:bg-gray-100">
              Try again
            </button>
          )}
          <button
            onClick={() => runRound(pickTarget(voice, target))}
            className="rounded-lg border px-6 py-3 hover:bg-gray-100"
          >
            {phase === "idle" ? "Play a note" : "Next note"}
          </button>
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">Tip: use headphones so the mic doesn&apos;t pick up the reference note.</p>
    </main>
  );
}