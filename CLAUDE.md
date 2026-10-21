@AGENTS.md

# Singing Trainer

A full-stack web app that trains a complete beginner to sing. You sing into the mic, the app detects your pitch live, and it coaches you through exercises, scores you and tracks your progress.

**This is a learning project.** The owner is building it by hand to practise full-stack development. When helping, explain the *why* behind changes. Prefer guiding over writing large chunks of code unless asked to just do it.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind.** No `src/` directory; `@/` maps to the project root.
- **Supabase.** Postgres, Auth, Row Level Security. Not added yet; that's Phase 4.
- **Web Audio API + `pitchy`.** Pitch detection runs entirely in the browser. Mic audio never leaves the device; only scores get saved.
- **`smplr`.** Plays recorded "Voice Oohs" soundfont samples as reference notes, with a synth fallback.
- **Vercel.** For deployment, in Phase 7.

## Commands

```bash
npm run dev     # local dev server at http://localhost:3000
npm run build   # production build
npm run lint
```

## Project structure

```
app/
  page.tsx            Match-the-note exercise (the app's only page)
components/
  PitchGraph.tsx      Scrolling canvas graph of your voice vs target band
lib/
  utils.ts            sleep()
  audio/
    notes.ts          Hz <-> MIDI <-> note name maths, cents
    usePitch.ts       Mic + pitchy hook, with median smoothing and dropout hold
    tonePlayer.ts     playTone(midi, seconds) using voice samples, synth fallback, preloadTone()
    config.ts         IN_TUNE_CENTS (shared in-tune threshold, currently 20)
  exercises/
    scoring.ts        scoreAttempt(): accuracy %, avg cents, settle time, octave folding; scoreSequence() for patterns
    voices.ts         VOICE_RANGES, Voice, randomNoteInRange()
    patterns.ts       Pattern type, FIVE_NOTE_SCALE (semitone offsets + syllables)
```

## Conventions

- **Audio logic lives in `lib/audio`, exercise logic in `lib/exercises`.** Keep these as plain TypeScript, so they're testable without React. Pages and components stay thin.
- **Shared settings get one home.** For example, `IN_TUNE_CENTS` lives in `lib/audio/config.ts`.
- **Animation loops (pitch detection, graph) use refs and `requestAnimationFrame`, not React state.** Only values the UI displays go in state.
- **The "latest value in a ref" pattern** is used to feed props into long-running loops.
- **Exercises are small async state machines:** `idle -> listen -> sing -> result`. Listening and singing never overlap, because the mic would hear the reference tone.
- **Pitch is compared in MIDI numbers or cents, not Hz.**
- **Patterns are stored as semitone offsets from a root note**, so any exercise fits any voice.

## Git workflow

- One branch per phase (`phase-N-name`). Commit small and often, push, open a PR, merge into `main`.
- `.env.local` holds secrets and is gitignored. Commit `.env.example` with variable names only.

---

## Progress

### Done

**Phase 1: Pitch detector.**
- `notes.ts`: frequency to MIDI to note name and cents.
- `usePitch` hook: `getUserMedia` with echo cancellation, noise suppression and auto gain turned off; AnalyserNode with fftSize 2048; pitchy with a clarity threshold of 0.9 and a 60–1200 Hz range.
- Fixed flicker with median smoothing over 7 frames and a hold of 10 frames before clearing to silence.
- In-tune threshold widened to ±20 cents for a beginner. The plan is to tighten it to 15, then 10, as accuracy improves.

**Phase 2: Pitch graph.**
- `PitchGraph`: a canvas with its own rAF loop, a 5 s window, a 1-octave view that eases towards the target or the voice, semitone grid lines with note labels, DPR scaling, a target band, and line segments coloured green or amber.
- Free practice page with a target note picker from A2 to A4. (Later removed: the app is now just match-the-note.)

**Phase 3a: Match the note.**
- `tonePlayer.ts`: `smplr` Soundfont `voice_oohs` (try `choir_aahs` as an alternative), with a cached load promise and a synth fallback. The synth uses detuned sawtooths, vibrato, a low-pass filter and an envelope.
- `scoring.ts`: `scoreAttempt`, with a 500 ms settle time, at least 10 samples, octave folding via `centsFromTarget`, accuracy as % of time in tune, and signed average cents.
- Match page (now the home page at `/`): lower/higher voice toggle, play → sing for 3 s → score, with sharp/flat feedback, "Try again" and "Next note".

**Phase 3b: 5-note scale.**
- Shared pieces extracted: `lib/utils.ts` (`sleep`), `lib/exercises/voices.ts`, `lib/exercises/patterns.ts`. The match page imports them.
- `scoreAttempt` takes optional `{ settleMs, minSamples }`. `scoreSequence(samples, windows)` scores each note window (150 ms settle, at least 5 samples), counts missed notes as 0 and returns `{ perNote, overall }`.
- `PitchGraph` has an optional `centerMidi` prop; the view follows `centerMidi ?? target ?? voice`.
- **`/scale` page shelved for now** (focusing on pitch practice). It was built and then removed; it's in git history (commit `6bd6aa1`) if we bring it back. The `lib/` pieces above stay.

### To do

**Phase 4: Supabase + auth** (branch `phase-4-supabase`).
- Create a Supabase project, put its keys in `.env.local`, check `git status` doesn't list it, and commit `.env.example`.
- Install `@supabase/supabase-js` and `@supabase/ssr`. Add browser and server client helpers in `lib/supabase/`.
- Write a migration in `supabase/migrations/` for these tables, with RLS turned on for all of them:
  - `profiles`: id (references `auth.users`), display_name, voice_type, range_low, range_high (MIDI numbers).
  - `exercises`: id, slug, name, level, sort_order, type (`match` | `pattern`), pattern (jsonb of offsets and syllables). Read-only for users.
  - `sessions`: id, user_id, started_at, duration_sec.
  - `attempts`: id, session_id, user_id, exercise_id, target/root midi, accuracy, avg_cents, per_note (jsonb), created_at.
  - Policies use `user_id = auth.uid()`. `exercises` can be read by any authenticated user.
- Sign-up and login pages under `app/(auth)/`, plus middleware that protects the practice routes.
- Seed `exercises` with match-the-note and the 5-note scale, then load them from the database instead of hard-coding them.

**Phase 5: Saving progress.**
- A server action that saves sessions and attempts after each round, from `AttemptResult` / `SequenceResult`.
- A `/progress` page: accuracy over time, streak, attempts per exercise, and sharp/flat tendency.

**Phase 6: Beginner curriculum + range finder.**
- A `/range` page: sing your lowest and highest comfortable notes, then save `range_low`/`range_high` to `profiles`. This replaces the lower/higher voice toggle.
- Transpose all exercises into the user's range.
- A daily 10–15 minute plan: breathing → warm-up (lip trills) → scales → ear training.
- Make difficulty adapt: tighten `IN_TUNE_CENTS` per user as accuracy improves, and add longer patterns.
- More exercises: ear training (hear 2 notes, say which is higher), and wider patterns like the octave arpeggio.

**Phase 7: Polish + deploy.**
- Mic permission errors and an unsupported-browser message.
- Mobile layout.
- Dark mode, including canvas colours (currently hard-coded hex in `PitchGraph`).
- A headphones tip in onboarding.
- Deploy to Vercel, with the env vars set in the Vercel dashboard.

## Known notes and ideas

- If the reading shows "—" too often, try `MIN_CLARITY = 0.85` in `usePitch.ts`.
- The voice samples download from the internet on first use; `preloadTone()` is called on page mount to hide the delay.
- Run `getSoundfontNames()` from `smplr` to list the available sample instruments.
