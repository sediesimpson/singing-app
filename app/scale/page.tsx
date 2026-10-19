"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePitch } from "@/lib/audio/usePitch";
import { playTone, preloadTone } from "@/lib/audio/tonePlayer";
import { midiToNoteName } from "@/lib/audio/notes";
import { IN_TUNE_CENTS } from "@/lib/audio/config";
import {
  scoreSequence,
  type NoteWindow,
  type Sample,
  type SequenceResult,
} from "@/lib/exercises/scoring";
import { FIVE_NOTE_SCALE } from "@/lib/exercises/patterns";
import { VOICE_RANGES, randomNoteInRange, type Voice } from "@/lib/exercises/voices";
import { PitchGraph } from "@/components/PitchGraph";
import { sleep } from "@/lib/utils";

type Phase = "idle" | "listen" | "ready" | "sing" | "result";

const PATTERN = FIVE_NOTE_SCALE;
const SPAN = Math.max(...PATTERN.steps.map((s) => s.offset)); // how far above the root the pattern goes

const LISTEN_NOTE_SEC = 0.55;
const READY_MS = 1000;
const SING_NOTE_MS = 800;

// Keep the whole pattern inside the voice range: the root can go no higher than high - SPAN
function pickRoot(voice: Voice, previous: number | null): number {
  const { low, high } = VOICE_RANGES[voice];
  return randomNoteInRange(low, high - SPAN, previous);
}

function chipColor(accuracy: number | null): string {
  if (accuracy === null) return "bg-gray-100 text-gray-400";
  if (accuracy >= 70) return "bg-green-100 text-green-800";
  if (accuracy >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

function trickiestTip(result: SequenceResult, root: number): string | null {
  let worst = 0;
  result.perNote.forEach((r, i) => {
    if ((r?.accuracy ?? 0) < (result.perNote[worst]?.accuracy ?? 0)) worst = i;
  });
  const r = result.perNote[worst];
  if (r && r.accuracy >= 70) return null; // every note was good, nothing to pick on

  const step = PATTERN.steps[worst];
  const label = `${step.syllable} (${midiToNoteName(root + step.offset)})`;
  if (!r) return `Trickiest note: ${label}. I didn't hear it, so make sure you keep singing all the way through.`;
  if (r.avgCents > IN_TUNE_CENTS) return `Trickiest note: ${label}. You were sharp, so aim slightly lower.`;
  if (r.avgCents < -IN_TUNE_CENTS) return `Trickiest note: ${label}. You were flat, so aim slightly higher.`;
  return `Trickiest note: ${label}. Try landing on it more cleanly.`;
}

export default function ScalePage() {
  const { reading, isListening, error, start } = usePitch();
  const [voice, setVoice] = useState<Voice>("lower");
  const [phase, setPhase] = useState<Phase>("idle");
  const [root, setRoot] = useState<number | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [result, setResult] = useState<SequenceResult | null>(null);

  const samplesRef = useRef<Sample[]>([]);

  // While you're singing, collect every pitch reading with a timestamp
  useEffect(() => {
    if (phase === "sing" && reading) {
      samplesRef.current.push({ t: performance.now(), midi: reading.midi });
    }
  }, [phase, reading]);

  useEffect(() => {
    preloadTone();
  }, []);

  async function runRound(newRoot: number) {
    if (!isListening) await start();
    setResult(null);
    setRoot(newRoot);

    // 1. Play the whole pattern so you know what to sing
    setPhase("listen");
    for (let i = 0; i < PATTERN.steps.length; i++) {
      setStepIndex(i);
      await playTone(newRoot + PATTERN.steps[i].offset, LISTEN_NOTE_SEC);
    }

    // 2. A short breath, so the mic doesn't hear the last reference note
    setStepIndex(null);
    setPhase("ready");
    await sleep(READY_MS);

    // 3. Sing it back, one window per note. Record the real start/end times,
    //    because setTimeout can drift a few ms.
    samplesRef.current = [];
    const windows: NoteWindow[] = [];
    setPhase("sing");
    for (let i = 0; i < PATTERN.steps.length; i++) {
      setStepIndex(i);
      const startedAt = performance.now();
      await sleep(SING_NOTE_MS);
      windows.push({
        target: newRoot + PATTERN.steps[i].offset,
        start: startedAt,
        end: performance.now(),
      });
    }

    setStepIndex(null);
    setResult(scoreSequence(samplesRef.current, windows));
    setPhase("result");
  }

  const busy = phase === "listen" || phase === "ready" || phase === "sing";
  const currentTarget =
    root !== null && stepIndex !== null ? root + PATTERN.steps[stepIndex].offset : null;
  const heardAnything = result?.perNote.some((r) => r !== null) ?? false;
  const tip = result && root !== null && heardAnything ? trickiestTip(result, root) : null;

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-8">
      <div className="w-full max-w-2xl flex items-center justify-between">
        <Link href="/" className="text-sm text-gray-500 hover:underline">← Free practice</Link>
        <div className="flex gap-2">
          {(Object.keys(VOICE_RANGES) as Voice[]).map((v) => (
            <button
              key={v}
              onClick={() => setVoice(v)}
              disabled={busy}
              className={`rounded-lg border px-3 py-1 text-sm ${voice === v ? "bg-gray-100 font-medium" : ""}`}
            >
              {VOICE_RANGES[v].label}
            </button>
          ))}
        </div>
      </div>

      <h1 className="text-2xl font-medium">5-note scale</h1>

      <div className="h-24 flex flex-col items-center justify-center text-center">
        {phase === "idle" && (
          <p className="text-gray-500">Listen to the scale, then sing it back: Do Re Mi Fa Sol Fa Mi Re Do.</p>
        )}
        {phase === "listen" && <p className="text-2xl">Listen…</p>}
        {phase === "ready" && <p className="text-2xl">Get ready…</p>}
        {phase === "sing" && <p className="text-2xl font-medium text-green-600">Now sing it!</p>}
        {phase === "result" && result && !heardAnything && (
          <p className="text-amber-600">I didn&apos;t hear you. Try singing a bit louder or closer to the mic.</p>
        )}
        {phase === "result" && result && heardAnything && (
          <>
            <p className="text-5xl font-medium">{result.overall}%</p>
            {tip ? <p className="text-gray-600">{tip}</p> : <p className="text-gray-600">Lovely, every note landed.</p>}
          </>
        )}
      </div>

      {/* One chip per note: highlights where you are, then shows each note's score */}
      <div className="flex flex-wrap justify-center gap-2">
        {PATTERN.steps.map((step, i) => {
          const noteResult = phase === "result" ? result?.perNote[i] : undefined;
          const isCurrent = i === stepIndex;
          const color =
            noteResult !== undefined
              ? chipColor(noteResult?.accuracy ?? null)
              : isCurrent
                ? "bg-gray-800 text-white"
                : "bg-gray-50 text-gray-500";
          return (
            <div key={i} className={`w-14 rounded-lg px-2 py-1 text-center ${color}`}>
              <div className="text-sm font-medium">{step.syllable}</div>
              <div className="text-xs">
                {noteResult !== undefined
                  ? noteResult ? `${noteResult.accuracy}%` : "—"
                  : root !== null ? midiToNoteName(root + step.offset) : ""}
              </div>
            </div>
          );
        })}
      </div>

      <div className="w-full max-w-2xl">
        <PitchGraph
          reading={reading}
          targetMidi={currentTarget}
          centerMidi={root !== null ? root + SPAN / 2 : null}
        />
      </div>

      {!busy && (
        <div className="flex gap-3">
          {phase === "result" && root !== null && (
            <button onClick={() => runRound(root)} className="rounded-lg border px-6 py-3 hover:bg-gray-100">
              Try again
            </button>
          )}
          <button
            onClick={() => runRound(pickRoot(voice, root))}
            className="rounded-lg border px-6 py-3 hover:bg-gray-100"
          >
            {phase === "idle" ? "Play the scale" : "New key"}
          </button>
        </div>
      )}

      {error && <p className="text-red-600">{error}</p>}
      <p className="text-xs text-gray-400">Tip: use headphones so the mic doesn&apos;t pick up the reference notes.</p>
    </main>
  );
}
