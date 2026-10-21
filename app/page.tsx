"use client";

import { useEffect, useRef, useState } from "react";
import { usePitch } from "@/lib/audio/usePitch";
import { playTone, preloadTone } from "@/lib/audio/tonePlayer";
import { IN_TUNE_CENTS } from "@/lib/audio/config";
import { scoreAttempt, type AttemptResult, type Sample } from "@/lib/exercises/scoring";
import { PitchGraph } from "@/components/PitchGraph";
import { sleep } from "@/lib/utils";
import { VOICE_RANGES, randomNoteInRange, type Voice } from "@/lib/exercises/voices";

type Phase = "idle" | "listen" | "sing" | "result";

const TONE_SECONDS = 1.5;
const GAP_MS = 300;
const SING_MS = 5000;

function pickTarget(voice: Voice, previous: number | null): number {
  const { low, high } = VOICE_RANGES[voice];
  return randomNoteInRange(low, high, previous);
}

function scoreColor(accuracy: number): string {
  if (accuracy >= 70) return "text-green-600";
  if (accuracy >= 40) return "text-amber-500";
  return "text-red-500";
}

function feedback(r: AttemptResult): string {
  if (r.accuracy >= 70) return "Spot on. You matched it.";
  const opener = r.accuracy >= 40 ? "Close." : "Not quite.";
  if (r.avgCents > IN_TUNE_CENTS) return `${opener} You were sharp (too high), so aim lower.`;
  if (r.avgCents < -IN_TUNE_CENTS) return `${opener} You were flat (too low), so aim higher.`;
  return `${opener} You were wobbling around the note, so try holding it steadier.`;
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
    <main className="min-h-screen flex flex-col items-center px-6 py-6">
      <div className="w-full max-w-2xl flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <span className="text-sm font-semibold tracking-tight">Singing Trainer</span>
          {/* Voice range: a two-way switch, locked while a round is running */}
          <div className="flex rounded-full bg-gray-100 p-1 text-sm">
            {(Object.keys(VOICE_RANGES) as Voice[]).map((v) => (
              <button
                key={v}
                onClick={() => setVoice(v)}
                disabled={busy}
                className={`rounded-full px-3 py-1 transition disabled:cursor-not-allowed ${
                  voice === v ? "bg-white font-medium shadow-sm" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                {VOICE_RANGES[v].label}
              </button>
            ))}
          </div>
        </header>

        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Match the note</h1>
          <p className="mt-1 text-gray-500">Listen to the note, then sing it back.</p>
        </div>

        {/* Status: fixed height so the graph doesn't jump around between phases */}
        <div className="h-24 flex flex-col items-center justify-center gap-2 text-center">
          {phase === "idle" && <p className="text-gray-400">Press play when you&apos;re ready.</p>}
          {phase === "listen" && (
            <>
              <span className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-500" />
                Listening
              </span>
              <p className="text-2xl font-medium">Listen to the note…</p>
            </>
          )}
          {phase === "sing" && (
            <>
              <p className="text-2xl font-semibold text-green-600">Now sing it!</p>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full origin-left rounded-full bg-green-500"
                  style={{ animation: `fill-bar ${SING_MS}ms linear forwards` }}
                />
              </div>
            </>
          )}
          {phase === "result" && result === "no-voice" && (
            <p className="max-w-sm text-amber-600">I didn&apos;t hear you. Try singing a bit louder or closer to the mic.</p>
          )}
          {phase === "result" && result && result !== "no-voice" && (
            <>
              <p className={`text-6xl font-semibold tabular-nums tracking-tight ${scoreColor(result.accuracy)}`}>
                {result.accuracy}%
              </p>
              <p className="text-gray-600">{feedback(result)}</p>
            </>
          )}
        </div>

        {/* Hide the mic while the reference note plays, or the graph would draw the speaker, not you */}
        <PitchGraph
          reading={phase === "listen" ? null : reading}
          targetMidi={target}
          paused={phase === "result"}
          height={240}
        />

        {/* Fixed height for the same reason: buttons hide while you sing */}
        <div className="h-12 flex justify-center gap-3">
          {!busy && phase === "result" && target !== null && (
            <button
              onClick={() => runRound(target)}
              className="rounded-full bg-white px-6 font-medium ring-1 ring-gray-200 transition hover:bg-gray-50"
            >
              Try again
            </button>
          )}
          {!busy && (
            <button
              onClick={() => runRound(pickTarget(voice, target))}
              className="rounded-full bg-gray-900 px-6 font-medium text-white transition hover:bg-gray-700"
            >
              {phase === "idle" ? "Play a note" : "Next note"}
            </button>
          )}
        </div>

        {error && <p className="text-center text-sm text-red-600">{error}</p>}
        <p className="text-center text-xs text-gray-400">
          Tip: use headphones so the mic doesn&apos;t pick up the reference note.
        </p>
      </div>
    </main>
  );
}
