"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { DIFFICULTY_LEVELS, type Difficulty } from "@/lib/audio/config";
import { VOICE_RANGES, type Voice } from "@/lib/exercises/voices";
import { midiToNoteName } from "@/lib/audio/notes";
import {
  dailyAccuracy,
  dayStreak,
  mostPlayed,
  rangeBands,
  summarise,
  tendency,
  type RangeBand,
  type SavedAttempt,
} from "@/lib/exercises/progress";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AccuracyChart } from "@/components/AccuracyChart";
import { scoreBar, scoreChip, scoreColor } from "@/components/score";

const CHART_DAYS = 30;
const RECENT_COUNT = 10;

const DIFFICULTY_OPTIONS = (Object.keys(DIFFICULTY_LEVELS) as Difficulty[]).map((d) => ({
  value: d,
  label: DIFFICULTY_LEVELS[d].label,
}));
const VOICE_OPTIONS = (Object.keys(VOICE_RANGES) as Voice[]).map((v) => ({ value: v, label: VOICE_RANGES[v].label }));

const timeAgo = (d: Date) => {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const mins = Math.round((d.getTime() - Date.now()) / 60000);
  if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
};

function tendencyText(cents: number): string {
  if (Math.abs(cents) <= 5) return "you're right on the note on average: not too high, not too low.";
  const amount = Math.abs(cents) <= 25 ? "a little" : "quite a bit";
  return cents > 0
    ? `you usually sing ${amount} too high, so aim slightly lower.`
    : `you usually sing ${amount} too low, so aim slightly higher.`;
}

function rangeTip(bands: RangeBand[]): string | null {
  const tried = bands.filter((b) => b.accuracy !== null);
  if (tried.length < 2) return null;
  if (tried.every((b) => b.accuracy! >= 70)) return "every part of your range is strong.";
  const worst = tried.reduce((a, b) => (b.accuracy! < a.accuracy! ? b : a));
  return `your ${worst.name} notes are the trickiest, so take those slowly.`;
}

export function ProgressView() {
  const [attempts, setAttempts] = useState<SavedAttempt[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    createClient()
      .from("attempts")
      .select("target_midi, voice, difficulty, accuracy, avg_cents, created_at")
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (error || !data) return setLoadError(true);
        setAttempts(
          data.map((r) => ({
            targetMidi: r.target_midi,
            voice: r.voice,
            difficulty: r.difficulty,
            accuracy: r.accuracy,
            avgCents: r.avg_cents,
            createdAt: new Date(r.created_at),
          }))
        );
      });
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-10 lowercase [&_button]:lowercase">
      <div className="w-full max-w-2xl flex flex-col gap-8">
        <header className="flex items-center justify-between">
          <Link href="/" aria-label="Singing Trainer: back to practice" className="text-2xl leading-none text-gray-800">
            ♫♫♫
          </Link>
          <Link href="/" className="text-sm font-medium text-gray-500 hover:text-gray-900">
            practise →
          </Link>
        </header>

        <h1 className="text-3xl font-semibold tracking-tight">your progress</h1>

        {loadError && <p className="text-red-600">couldn&apos;t load your progress. try refreshing the page.</p>}
        {!attempts && !loadError && <p className="text-gray-400">loading your progress…</p>}

        {attempts && attempts.length === 0 && (
          <div className="flex flex-col items-start gap-4 rounded-2xl bg-gray-50 p-6">
            <p className="text-gray-600">sing a few tries and your progress will show up here.</p>
            <Link href="/" className="rounded-full bg-gray-900 px-6 py-3 font-medium text-white hover:bg-gray-700">
              start practising
            </Link>
          </div>
        )}

        {attempts && attempts.length > 0 && <Dashboard attempts={attempts} />}
      </div>
    </main>
  );
}

// Everything that depends on today's date. It only renders once your rounds have loaded in the
// browser, so it never runs while Next prerenders the page (Cache Components forbids reading the
// clock there) and dates use your own time zone.
function Dashboard({ attempts }: { attempts: SavedAttempt[] }) {
  // null = not chosen yet, so use whatever you've played most
  const [chosenDifficulty, setChosenDifficulty] = useState<Difficulty | null>(null);
  const [chosenVoice, setChosenVoice] = useState<Voice | null>(null);

  const difficulty = chosenDifficulty ?? mostPlayed(attempts.map((a) => a.difficulty), "beginner");
  const voice = chosenVoice ?? mostPlayed(attempts.map((a) => a.voice), "lower");
  const shown = attempts.filter((a) => a.difficulty === difficulty && a.voice === voice);

  const streak = dayStreak(attempts); // practice days count whatever level you sang at
  const summary = summarise(shown);
  const daily = dailyAccuracy(shown, CHART_DAYS);
  const lean = tendency(shown);
  const bands = rangeBands(shown, voice);
  const tip = rangeTip(bands);

  return (
    <>
      {/* One filter row for everything below it */}
      <div className="flex flex-wrap gap-2">
        <SegmentedControl options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setChosenDifficulty} />
        <SegmentedControl options={VOICE_OPTIONS} value={voice} onChange={setChosenVoice} />
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label={streak === 1 ? "day streak" : "days in a row"} value={String(streak)} />
        <Tile
          label="average score"
          value={summary.averageScore === null ? "—" : `${summary.averageScore}%`}
          note={
            summary.changeVsLastWeek === null
              ? undefined
              : `${summary.changeVsLastWeek >= 0 ? "↑" : "↓"} ${Math.abs(summary.changeVsLastWeek)} on last week`
          }
        />
        <Tile label="tries" value={String(summary.rounds)} />
        <Tile label="best score" value={summary.bestScore === null ? "—" : `${summary.bestScore}%`} />
      </section>

      {shown.length === 0 ? (
        <p className="text-gray-500">no tries at this level and voice yet. try another filter above.</p>
      ) : (
        <>
          <Card title="accuracy over time" subtitle={`average score per day, last ${CHART_DAYS} days`}>
            {daily.length === 0 ? (
              <p className="text-sm text-gray-500">no tries in the last {CHART_DAYS} days.</p>
            ) : (
              <>
                <AccuracyChart points={daily} days={CHART_DAYS} />
                <details className="mt-2 text-sm text-gray-500">
                  <summary className="cursor-pointer">view as table</summary>
                  <table className="mt-2 w-full text-left">
                    <thead className="text-gray-400">
                      <tr><th className="font-normal">day</th><th className="font-normal">average</th><th className="font-normal">tries</th></tr>
                    </thead>
                    <tbody className="tabular-nums text-gray-700">
                      {daily.map((p) => (
                        <tr key={p.day.getTime()}>
                          <td>{p.day.toLocaleDateString("en", { month: "short", day: "numeric" })}</td>
                          <td>{p.accuracy}%</td>
                          <td>{p.rounds}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </>
            )}
          </Card>

          {lean !== null && (
            <Card title="your tendency" subtitle="do you usually land too high or too low?">
              <TendencyBar cents={lean} />
              <p className="mt-3 text-gray-600">{tendencyText(lean)}</p>
            </Card>
          )}

          <Card title="your range" subtitle="how you do on the low, middle and high notes of your voice">
            <div className="flex flex-col gap-5">
              {bands.map((band) => (
                <div key={band.name} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm font-medium">{band.name} notes</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      {band.accuracy !== null && (
                        <div className={`h-full rounded-full ${scoreBar(band.accuracy)}`} style={{ width: `${band.accuracy}%` }} />
                      )}
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm text-gray-700">
                      {band.accuracy === null ? "—" : `${band.accuracy}%`}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-0 sm:pl-31">
                    {band.notes.map((n) => (
                      <span
                        key={n.midi}
                        title={n.accuracy === null ? "not tried yet" : `${n.accuracy}% over ${n.rounds} ${n.rounds === 1 ? "try" : "tries"}`}
                        className={`rounded-md px-2 py-1 text-xs font-medium normal-case ${scoreChip(n.accuracy)}`}
                      >
                        {midiToNoteName(n.midi)}
                        {n.accuracy !== null && <span className="ml-1 font-normal opacity-80">{n.accuracy}%</span>}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {tip && <p className="mt-4 text-gray-600">{tip}</p>}
            <p className="mt-2 text-xs text-gray-400">green = strong · amber = okay · red = tricky · grey = not tried yet</p>
          </Card>

          <Card title="your last tries">
            <ul className="divide-y divide-gray-100">
              {shown.slice(0, RECENT_COUNT).map((a) => (
                <li key={a.createdAt.getTime()} className="flex items-center justify-between py-2 text-sm">
                  <span className="w-12 font-medium normal-case">{midiToNoteName(a.targetMidi)}</span>
                  <span className={`w-12 font-semibold ${scoreColor(a.accuracy)}`}>{a.accuracy}%</span>
                  <span className="flex-1 text-right text-gray-400">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-gray-50 p-4">
      <div className="text-2xl font-semibold tracking-tight">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
      {note && <div className="mt-1 text-xs text-gray-400">{note}</div>}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 ring-1 ring-gray-100">
      <h2 className="font-semibold">{title}</h2>
      {subtitle && <p className="mb-4 text-sm text-gray-500">{subtitle}</p>}
      {!subtitle && <div className="mb-2" />}
      {children}
    </section>
  );
}

// A track from "too low" to "too high" with a dot where you usually land (clamped to ±50 cents)
function TendencyBar({ cents }: { cents: number }) {
  const pos = 50 + Math.max(-50, Math.min(50, cents));
  return (
    <div>
      <div className="relative h-2 rounded-full bg-gray-100">
        <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-y-1/2 bg-gray-300" />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-gray-800"
          style={{ left: `${pos}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-xs text-gray-400">
        <span>too low</span>
        <span>spot on</span>
        <span>too high</span>
      </div>
    </div>
  );
}
