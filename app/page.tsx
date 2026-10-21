"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePitch } from "@/lib/audio/usePitch";
import { playTone, preloadTone, unlockAudio } from "@/lib/audio/tonePlayer";
import { DIFFICULTY_LEVELS, type Difficulty } from "@/lib/audio/config";
import { scoreAttempt, type AttemptResult, type Sample } from "@/lib/exercises/scoring";
import { PitchGraph } from "@/components/PitchGraph";
import { SegmentedControl } from "@/components/SegmentedControl";
import { sleep } from "@/lib/utils";
import { VOICE_RANGES, randomNoteInRange, type Voice } from "@/lib/exercises/voices";
import { createClient } from "@/lib/supabase/client";
import { saveAttempt } from "@/app/actions";

type Phase = "idle" | "listen" | "sing" | "result";
type SaveState = "idle" | "saving" | "saved" | "error";

const TONE_SECONDS = 1.5;
const GAP_MS = 500; // covers the note fading out, plus usePitch holding its last reading
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

const VOICE_OPTIONS = (Object.keys(VOICE_RANGES) as Voice[]).map((v) => ({ value: v, label: VOICE_RANGES[v].label }));
const DIFFICULTY_OPTIONS = (Object.keys(DIFFICULTY_LEVELS) as Difficulty[]).map((d) => ({
  value: d,
  label: DIFFICULTY_LEVELS[d].label,
}));

function feedback(r: AttemptResult, inTuneCents: number): string {
  if (r.accuracy >= 70) return "Spot on. You matched it.";
  const opener = r.accuracy >= 40 ? "Close." : "Not quite.";
  if (r.avgCents > inTuneCents) return `${opener} You were sharp (too high), so aim lower.`;
  if (r.avgCents < -inTuneCents) return `${opener} You were flat (too low), so aim higher.`;
  return `${opener} You were wobbling around the note, so try holding it steadier.`;
}

export default function MatchPage() {
  const { reading, isListening, error, start } = usePitch();
  const [voice, setVoice] = useState<Voice>("lower");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const inTuneCents = DIFFICULTY_LEVELS[difficulty].inTuneCents;
  const [phase, setPhase] = useState<Phase>("idle");
  const [target, setTarget] = useState<number | null>(null);
  const [result, setResult] = useState<AttemptResult | "no-voice" | null>(null);
  // undefined = still checking, null = logged out (that's fine, practice still works)
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [saveState, setSaveState] = useState<SaveState>("idle");

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

  // Find out whether someone is logged in, and keep it up to date if they sign out
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getClaims().then(({ data }) => setEmail(data?.claims?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setEmail(session?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await createClient().auth.signOut();
    setSaveState("idle");
  }

  async function runRound(note: number) {
    unlockAudio(); // must come first: after the first `await` the phone no longer counts this as part of the tap
    if (!isListening) await start();
    setResult(null);
    setSaveState("idle");
    setTarget(note);

    setPhase("listen");
    await playTone(note, TONE_SECONDS);
    await sleep(GAP_MS);

    samplesRef.current = [];
    singStartRef.current = performance.now();
    setPhase("sing");
    await sleep(SING_MS);

    const score = scoreAttempt(samplesRef.current, note, singStartRef.current, { inTuneCents });
    setResult(score ?? "no-voice");
    setPhase("result");

    // Logged in? Save the score in the background. Rounds where we didn't hear you aren't saved.
    if (score && email) {
      setSaveState("saving");
      const { ok } = await saveAttempt({
        targetMidi: note,
        voice,
        difficulty,
        accuracy: score.accuracy,
        avgCents: score.avgCents,
        sampleCount: score.sampleCount,
      }).catch(() => ({ ok: false }));
      setSaveState(ok ? "saved" : "error");
    }
  }

  const busy = phase === "listen" || phase === "sing";

  // All text is lowercase. Buttons need their own rule: Tailwind's base styles reset text-transform on them
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-6 lowercase [&_button]:lowercase">
      <div className="w-full max-w-2xl flex flex-col gap-5">
        <header className="flex items-center justify-between">
          <span role="img" aria-label="Singing Trainer" className="text-2xl leading-none text-gray-800">
            ♫♫♫
          </span>
          {/* Settings are locked while a round is running */}
          <div className="flex flex-wrap justify-end gap-2">
            <SegmentedControl options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} disabled={busy} />
            <SegmentedControl options={VOICE_OPTIONS} value={voice} onChange={setVoice} disabled={busy} />
          </div>
        </header>

        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight">match the note</h1>
          <p className="mt-1 text-gray-500">listen to the note, then sing it back.</p>
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
              <p className="text-gray-600">{feedback(result, inTuneCents)}</p>
            </>
          )}
        </div>

        {/* Hide the mic while the reference note plays, or the graph would draw the speaker, not you */}
        <PitchGraph
          reading={phase === "listen" ? null : reading}
          targetMidi={target}
          paused={phase === "result"}
          inTuneCents={inTuneCents}
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
        {/* Logging in is optional: it's only needed to save your progress */}
        <footer className="h-5 text-center text-xs text-gray-500">
          {email === null && (
            <>
              <Link href="/login" className="font-medium text-gray-900 hover:underline">log in</Link> or{" "}
              <Link href="/signup" className="font-medium text-gray-900 hover:underline">sign up</Link> to save your progress
            </>
          )}
          {email && (
            <>
              {saveState === "saved" && "saved · "}
              {saveState === "error" && <span className="text-red-600">couldn&apos;t save that one · </span>}
              logged in as {email} ·{" "}
              <button onClick={signOut} className="font-medium text-gray-900 hover:underline">
                sign out
              </button>
            </>
          )}
        </footer>
      </div>
    </main>
  );
}
